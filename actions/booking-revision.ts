"use server";

import { revalidateTag } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { canAccessBooking, getProfileDataScope } from "@/lib/access-control";
import { createBookingRevision, refreshCurrentRevisionSnapshot } from "@/lib/booking-revision";
import { buildBookingApprovalSteps } from "@/lib/approval-flows";
import { generateAccessCode } from "@/lib/access-code";
import { computeFullPrice, calcFinalFromFullPrice } from "@/lib/package-prices";
import { restoreBookingRevisionSchema, syncBookingPackageSchema } from "@/lib/validations/booking";
import { getTermAllocatedMap } from "@/lib/queries/ledger";

// ─── Shapes read out of BookingRevision.snapshotData (see lib/booking-revision.ts
//     buildSnapshotData). Narrow interfaces so we never touch `any`. ────────────
interface SnapCustomerData {
  name: string;
  emailCpp: string | null;
  emailCpw: string | null;
  mobileNumber: string;
  cppNik: string | null;
  cpwNik: string | null;
  cppIdType: string;
  cpwIdType: string;
  ktpAddress: string | null;
  cppAddress: string | null;
  cpwAddress: string | null;
}
interface SnapVenueData {
  venueId: string;
  venueName: string;
  address: string | null;
  description: string | null;
  brandName: string | null;
  brandCode: string | null;
}
interface SnapPackageData {
  packageId: string;
  packageName: string;
  notes: string | null;
}
interface SnapPricingData {
  packageId: string;
  packageName: string;
  pax: number;
  price: number;
  fullPrice: number;
  margin: number;
  termAndCondition: string | null;
}
interface InternalItemData {
  itemName: string;
  itemDescription: string;
  sortOrder: number;
}
interface VendorItemData {
  categoryId: string | null;
  categoryName: string;
  itemText: string;
  sortOrder: number;
  isTakeout: boolean;
}
interface CategoryPriceData {
  categoryId: string | null;
  categoryName: string;
  basePrice: number;
  sortOrder: number;
  isShow: boolean;
  isTakeout: boolean;
  takeoutNominal: number;
}
interface ComplimentaryData {
  complimentaryId: string | null;
  name: string;
  price: number;
  isShowPrice: boolean;
  description: string | null;
  qty: number;
  sortOrder: number;
}
interface BonusData {
  vendorId: string;
  vendorCategoryId: string;
  vendorName: string;
  description: string | null;
  qty: number;
  nominal: number;
  orderStatusId: string | null;
}
interface SnapshotData {
  weddingType: string | null;
  signingLocation: string | null;
  discountName: string | null;
  discountAmount: number;
  snapCustomer: SnapCustomerData | null;
  snapVenue: SnapVenueData | null;
  snapPackage: SnapPackageData | null;
  snapPackagePricing: SnapPricingData | null;
  snapPackageInternalItems: InternalItemData[];
  snapPackageVendorItems: VendorItemData[];
  snapPackageCategoryPrices: CategoryPriceData[];
  snapComplimentaries: ComplimentaryData[];
  snapBonuses: BonusData[];
}

/**
 * Restore a past BookingRevision as the booking's active version.
 *
 * The BookingRevision table is append-only: restoring does NOT delete or mutate any
 * historical revision. It rewrites the live snapshot tables (package/venue/pricing/
 * items/complimentary/bonus) to the target revision's content, then creates a NEW
 * revision from that restored state — so the timeline grows forward (v1..vN → vN+1
 * whose content equals the chosen old version). Approval is reset to Pending and the
 * client agreement is invalidated (the PO changed → must be re-signed).
 *
 * Money guard: refuses when any Term of Payment is already paid / refunded / finance-
 * acknowledged, because rolling the package price back would desync recorded payments.
 * Event date & session are intentionally left untouched (schedule is managed apart
 * from the "offer version"), so a restore never triggers a venue-availability clash.
 */
export async function restoreBookingRevision(
  data: unknown,
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "booking", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`booking-restore-revision:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = restoreBookingRevisionSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  const { bookingId, revisionId } = parsed.data;

  if (!session!.user.profileId) return { success: false, error: "Sesi tidak valid, silakan login ulang." };
  const scope = await getProfileDataScope(session!.user.profileId);
  if (!(await canAccessBooking(session!.user.profileId, scope, bookingId))) {
    return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
  }

  try {
    const [booking, revision, terms] = await Promise.all([
      db.booking.findUnique({
        where: { id: bookingId },
        select: { salesId: true, currentRevisionId: true },
      }),
      db.bookingRevision.findUnique({
        where: { id: revisionId },
        select: { id: true, bookingId: true, revisionNumber: true, snapshotData: true },
      }),
      db.termOfPayment.findMany({
        where: { bookingId },
        select: { id: true },
      }),
    ]);

    if (!booking) return { success: false, error: "Booking tidak ditemukan." };
    if (!revision || revision.bookingId !== bookingId) {
      return { success: false, error: "Versi tidak ditemukan untuk booking ini." };
    }
    if (revision.id === booking.currentRevisionId) {
      return { success: false, error: "Versi ini sudah menjadi versi aktif." };
    }

    // Money guard — block restore when payments are already recorded (§6.6, extended
    // by FIX A). Pure-derived: cek alokasi Ledger NON-VOID APAPUN (pending ATAU
    // acknowledged), bukan cuma ter-ack — konsisten dengan guard hapus termin di
    // updateTermOfPayments/editBooking (kolom TOP legacy sudah di-drop).
    const revisionAllocatedMap = await getTermAllocatedMap([bookingId]);
    const hasRecordedPayment = terms.some((t) => (revisionAllocatedMap.get(t.id) ?? 0) > 0);
    if (hasRecordedPayment) {
      return {
        success: false,
        error: "Ada pembayaran cash-in (pending/terverifikasi) yang masih nempel — versi tidak bisa di-restore. Void atau pindahkan pembayaran itu dulu.",
      };
    }

    const snap = revision.snapshotData as unknown as SnapshotData;
    if (!snap.snapCustomer || !snap.snapVenue || !snap.snapPackage || !snap.snapPackagePricing) {
      return { success: false, error: "Data versi tidak lengkap, tidak bisa di-restore." };
    }

    const c = snap.snapCustomer;
    const v = snap.snapVenue;
    const p = snap.snapPackage;
    const pr = snap.snapPackagePricing;

    // ── Transaction 1: rewrite live snapshot tables to the target revision content ──
    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.snapCustomer.update({
        where: { bookingId },
        data: {
          name: c.name,
          emailCpp: c.emailCpp,
          emailCpw: c.emailCpw,
          mobileNumber: c.mobileNumber,
          cppNik: c.cppNik,
          cpwNik: c.cpwNik,
          cppIdType: c.cppIdType,
          cpwIdType: c.cpwIdType,
          ktpAddress: c.ktpAddress,
          cppAddress: c.cppAddress,
          cpwAddress: c.cpwAddress,
        },
      }),
      db.snapVenue.update({
        where: { bookingId },
        data: {
          venueId: v.venueId,
          venueName: v.venueName,
          address: v.address,
          description: v.description,
          brandName: v.brandName,
          brandCode: v.brandCode,
        },
      }),
      db.snapPackage.update({
        where: { bookingId },
        data: { packageId: p.packageId, packageName: p.packageName, notes: p.notes },
      }),
      db.snapPackagePricing.upsert({
        where: { bookingId },
        create: {
          bookingId,
          packageId: pr.packageId,
          packageName: pr.packageName,
          pax: pr.pax,
          price: pr.price,
          fullPrice: pr.fullPrice,
          margin: pr.margin,
          termAndCondition: pr.termAndCondition,
        },
        update: {
          packageId: pr.packageId,
          packageName: pr.packageName,
          pax: pr.pax,
          price: pr.price,
          fullPrice: pr.fullPrice,
          margin: pr.margin,
          termAndCondition: pr.termAndCondition,
        },
      }),
      db.snapPackageInternalItem.deleteMany({ where: { bookingId } }),
      db.snapPackageVendorItem.deleteMany({ where: { bookingId } }),
      db.snapPackageCategoryPrice.deleteMany({ where: { bookingId } }),
      db.snapComplimentary.deleteMany({ where: { bookingId } }),
      db.snapBonus.deleteMany({ where: { bookingId } }),
      ...(snap.snapPackageInternalItems ?? []).map((item, i) =>
        db.snapPackageInternalItem.create({
          data: { bookingId, itemName: item.itemName, itemDescription: item.itemDescription ?? "", sortOrder: item.sortOrder ?? i },
        }),
      ),
      ...(snap.snapPackageVendorItems ?? []).map((item, i) =>
        db.snapPackageVendorItem.create({
          data: {
            bookingId,
            categoryId: item.categoryId ?? null,
            categoryName: item.categoryName,
            itemText: item.itemText,
            sortOrder: item.sortOrder ?? i,
            isTakeout: item.isTakeout ?? false,
          },
        }),
      ),
      ...(snap.snapPackageCategoryPrices ?? []).map((cp) =>
        db.snapPackageCategoryPrice.create({
          data: {
            bookingId,
            categoryId: cp.categoryId ?? null,
            categoryName: cp.categoryName,
            basePrice: cp.basePrice,
            sortOrder: cp.sortOrder,
            isShow: cp.isShow,
            isTakeout: cp.isTakeout,
            takeoutNominal: cp.takeoutNominal ?? 0,
          },
        }),
      ),
      ...(snap.snapComplimentaries ?? []).map((cm, i) =>
        db.snapComplimentary.create({
          data: {
            bookingId,
            complimentaryId: cm.complimentaryId ?? null,
            name: cm.name,
            price: cm.price ?? 0,
            isShowPrice: cm.isShowPrice ?? false,
            description: cm.description ?? null,
            qty: cm.qty ?? 1,
            sortOrder: cm.sortOrder ?? i,
          },
        }),
      ),
      ...(snap.snapBonuses ?? []).map((b) =>
        db.snapBonus.create({
          data: {
            bookingId,
            vendorId: b.vendorId,
            vendorCategoryId: b.vendorCategoryId,
            vendorName: b.vendorName,
            description: b.description ?? null,
            qty: b.qty ?? 1,
            nominal: b.nominal ?? 0,
            orderStatusId: b.orderStatusId ?? null,
          },
        }),
      ),
      db.booking.update({
        where: { id: bookingId },
        data: {
          packageId: p.packageId,
          venueId: v.venueId,
          weddingType: snap.weddingType ?? null,
          signingLocation: snap.signingLocation ?? null,
          discountName: snap.discountName ?? null,
          discountAmount: snap.discountAmount ?? 0,
          // Restoring produces a new revision the client must re-sign → lift freeze.
          snapshotFrozenAt: null,
        },
      }),
    ];

    await db.$transaction(ops);

    // ── Create the new revision from the now-restored live state (append-only). ──
    // Called AFTER the snap tables are rewritten so the new revision's snapshotData
    // equals the restored content (matches editBooking's ordering).
    const newRevisionId = await createBookingRevision(
      bookingId,
      session!.user.profileId!,
      `Restore dari Rev ${revision.revisionNumber}`,
    );

    // ── Transaction 2: reset approval + invalidate client agreement (mirror
    //    updateBookingCategoryPrices). New steps link the new revisionId. ──
    const approvalRecord = await db.approvalRecord.findUnique({
      where: { module_entityId: { module: "booking", entityId: bookingId } },
      select: { id: true },
    });
    const approvalSteps = await buildBookingApprovalSteps({
      salesId: booking.salesId,
      creatorProfileId: session!.user.profileId!,
      signatureSales: null,
      decidedAt: new Date(),
      includeClientStep: true,
    });

    const newToken = crypto.randomUUID();
    const newAccessCode = generateAccessCode();

    await db.$transaction([
      db.approvalRecord.updateMany({
        where: { module: "booking", entityId: bookingId },
        data: { status: "pending" },
      }),
      db.booking.update({
        where: { id: bookingId },
        data: { bookingStatus: "Pending", currentRevisionId: newRevisionId },
      }),
      db.clientAgreement.updateMany({
        where: { bookingId },
        data: {
          status: "Pending",
          token: newToken,
          accessCode: newAccessCode,
          signedAt: null,
          viewedAt: null,
        },
      }),
      ...(approvalRecord && approvalSteps && approvalSteps.length > 0
        ? approvalSteps.map((step) =>
            db.approvalRecordStep.create({
              data: {
                recordId: approvalRecord.id,
                stepOrder: step.stepOrder,
                approverType: step.approverType,
                approverRoleId: step.approverRoleId,
                approverUserId: step.approverUserId,
                status: step.status,
                decidedById: step.decidedById,
                decidedAt: step.decidedAt,
                signature: step.signature,
                revisionId: newRevisionId,
              },
            }),
          )
        : []),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "booking.revision_restored",
      result: "success",
      entityType: "booking",
      entityId: bookingId,
      changes: { restoredFromRevision: revision.revisionNumber, newRevisionId },
      description: `Restore booking ke versi Rev ${revision.revisionNumber} (${pr.packageName})`,
    });

    revalidateTag("bookings", "max");
    return { success: true };
  } catch (e) {
    console.error("[restoreBookingRevision]", e);
    return { success: false, error: "Gagal me-restore versi booking." };
  }
}

/**
 * Sync a booking's package snapshot from the CURRENT master Package.
 *
 * Use case: the master Package was set up wrong, snapshotted into a booking, then
 * corrected in the Package module. This re-pulls the master (name, notes, pricing,
 * internal/vendor items, category prices, margin, T&C) and overwrites the booking's
 * snapshot so it reflects the fixed master.
 *
 * Preserves per-booking takeout decisions: which categories are taken out (and the
 * partial nominal) live on the booking, not the master, so they are matched back by
 * categoryName and re-applied on top of the fresh master rows. The final price is
 * recomputed from the master's fullPrice minus the preserved takeout.
 *
 * Creates a NEW revision (history stays append-only) and resets approval + client
 * agreement — the PO content changed, so it must be re-approved and re-signed. TOP
 * (payment schedule) is intentionally NOT touched; if the price shifted, adjust it
 * via the Set Harga / TOP flow.
 */
export async function syncBookingPackage(
  data: unknown,
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "booking", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`booking-sync-package:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = syncBookingPackageSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  const { bookingId } = parsed.data;

  if (!session!.user.profileId) return { success: false, error: "Sesi tidak valid, silakan login ulang." };
  const scope = await getProfileDataScope(session!.user.profileId);
  if (!(await canAccessBooking(session!.user.profileId, scope, bookingId))) {
    return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
  }

  try {
    const [booking, currentSnapCats] = await Promise.all([
      db.booking.findUnique({
        where: { id: bookingId },
        select: { packageId: true, salesId: true, snapshotFrozenAt: true },
      }),
      db.snapPackageCategoryPrice.findMany({
        where: { bookingId },
        select: { categoryName: true, isTakeout: true, takeoutNominal: true },
      }),
    ]);

    if (!booking) return { success: false, error: "Booking tidak ditemukan." };
    if (!booking.packageId) return { success: false, error: "Booking ini tidak punya paket master untuk di-sync." };

    // Frozen = klien SUDAH TTD (snapshotFrozenAt di-stamp di route sign). Ini yang
    // menentukan apakah sync perlu reset approval. Sejalan dengan editBooking: selama
    // klien belum TTD, ganti isi paket TIDAK spin revisi baru & TIDAK reset approval —
    // approval Manager/Finance yang sudah ada tetap utuh, cukup refresh snapshot in-flight.
    const isFrozen = booking.snapshotFrozenAt != null;

    const masterPkg = await db.package.findUnique({
      where: { id: booking.packageId },
      include: { vendorItems: true, internalItems: true, categoryPrices: true },
    });
    if (!masterPkg) return { success: false, error: "Paket master tidak ditemukan (mungkin sudah dihapus)." };

    // Preserve per-booking takeout state, keyed by categoryName. Only visible master
    // categories can carry a takeout flag.
    const takeoutByName = new Map(
      currentSnapCats.map((c) => [c.categoryName, { isTakeout: c.isTakeout, takeoutNominal: c.takeoutNominal ?? 0 }]),
    );
    const takeoutCategoryIds = new Set(
      masterPkg.categoryPrices
        .filter((c) => c.isShow && (takeoutByName.get(c.categoryName)?.isTakeout ?? false) && c.categoryId)
        .map((c) => c.categoryId as string),
    );

    const fullPrice = computeFullPrice(masterPkg.categoryPrices, masterPkg.margin ?? 0, masterPkg.sellingPrice);
    const pkgPrice = calcFinalFromFullPrice(
      masterPkg.categoryPrices.map((c) => ({
        isShow: c.isShow,
        isTakeout: c.isShow ? (takeoutByName.get(c.categoryName)?.isTakeout ?? false) : false,
        basePrice: c.basePrice,
        takeoutNominal: takeoutByName.get(c.categoryName)?.takeoutNominal ?? 0,
      })),
      fullPrice,
    );

    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.snapPackage.update({
        where: { bookingId },
        data: { packageId: masterPkg.id, packageName: masterPkg.packageName, notes: masterPkg.notes },
      }),
      db.snapPackagePricing.upsert({
        where: { bookingId },
        create: {
          bookingId,
          packageId: masterPkg.id,
          packageName: masterPkg.packageName,
          pax: masterPkg.pax,
          price: pkgPrice,
          fullPrice,
          margin: masterPkg.margin ?? 0,
          termAndCondition: masterPkg.termAndCondition ?? null,
        },
        update: {
          packageId: masterPkg.id,
          packageName: masterPkg.packageName,
          pax: masterPkg.pax,
          price: pkgPrice,
          fullPrice,
          margin: masterPkg.margin ?? 0,
          termAndCondition: masterPkg.termAndCondition ?? null,
        },
      }),
      db.snapPackageInternalItem.deleteMany({ where: { bookingId } }),
      db.snapPackageVendorItem.deleteMany({ where: { bookingId } }),
      db.snapPackageCategoryPrice.deleteMany({ where: { bookingId } }),
      ...masterPkg.internalItems.map((item, i) =>
        db.snapPackageInternalItem.create({
          data: { bookingId, itemName: item.itemName, itemDescription: item.itemDescription, sortOrder: i },
        }),
      ),
      ...masterPkg.vendorItems.map((item, i) =>
        db.snapPackageVendorItem.create({
          data: {
            bookingId,
            categoryId: item.categoryId ?? null,
            categoryName: item.categoryName,
            itemText: item.itemText,
            sortOrder: i,
            isTakeout: item.categoryId ? takeoutCategoryIds.has(item.categoryId) : false,
          },
        }),
      ),
      ...masterPkg.categoryPrices.map((cp) => {
        const isTakeout = cp.isShow ? (takeoutByName.get(cp.categoryName)?.isTakeout ?? false) : false;
        return db.snapPackageCategoryPrice.create({
          data: {
            bookingId,
            categoryId: cp.categoryId ?? null,
            categoryName: cp.categoryName,
            basePrice: cp.basePrice,
            sortOrder: cp.sortOrder,
            isShow: cp.isShow,
            isTakeout,
            takeoutNominal: isTakeout ? ((takeoutByName.get(cp.categoryName)?.takeoutNominal ?? 0) || cp.basePrice) : 0,
          },
        });
      }),
      // Content changed → the client must re-sign; lift any existing freeze.
      db.booking.update({ where: { id: bookingId }, data: { snapshotFrozenAt: null } }),
    ];

    await db.$transaction(ops);

    // ── Belum TTD klien → jalur ringan (parity editBooking) ──────────────────────
    // Booking masih di revisi in-flight-nya: cukup refresh snapshot revisi aktif
    // in-place biar PO PDF ikut paket baru. TIDAK spin revisi baru, TIDAK reset
    // approvalRecord/step, TIDAK sentuh clientAgreement — approval yang sudah jalan
    // (Manager/Finance) tetap utuh, token TTD klien tetap (toh klien belum tanda tangan).
    if (!isFrozen) {
      // Best-effort: sinkronkan snapshot revisi aktif dengan live tables yang baru
      // ditimpa. No-op aman kalau tak ada revisi / sudah frozen (dijaga di helper).
      await refreshCurrentRevisionSnapshot(bookingId);

      await logAudit({
        userId: session!.user.id,
        action: "booking.package_synced",
        result: "success",
        entityType: "booking",
        entityId: bookingId,
        changes: { packageId: masterPkg.id, packageName: masterPkg.packageName, price: pkgPrice, reApproval: false },
        description: `Sync paket dari master: ${masterPkg.packageName} (${formatIdr(pkgPrice)}) — belum TTD, approval tidak direset`,
      });

      revalidateTag("bookings", "max");
      return { success: true };
    }

    // ── Sudah TTD klien → jalur penuh: revisi baru + reset approval + TTD ulang ───
    // Isi kontrak yang sudah ditandatangani berubah, jadi persetujuan lama tidak lagi
    // valid: bikin revisi append-only dari state hasil sync, lalu reset semua step.
    const newRevisionId = await createBookingRevision(
      bookingId,
      session!.user.profileId!,
      "Sync paket dari master",
    );

    const approvalRecord = await db.approvalRecord.findUnique({
      where: { module_entityId: { module: "booking", entityId: bookingId } },
      select: { id: true },
    });
    const approvalSteps = await buildBookingApprovalSteps({
      salesId: booking.salesId,
      creatorProfileId: session!.user.profileId!,
      signatureSales: null,
      decidedAt: new Date(),
      includeClientStep: true,
    });

    const newToken = crypto.randomUUID();
    const newAccessCode = generateAccessCode();

    await db.$transaction([
      db.approvalRecord.updateMany({
        where: { module: "booking", entityId: bookingId },
        data: { status: "pending" },
      }),
      db.booking.update({
        where: { id: bookingId },
        data: { bookingStatus: "Pending", currentRevisionId: newRevisionId },
      }),
      db.clientAgreement.updateMany({
        where: { bookingId },
        data: {
          status: "Pending",
          token: newToken,
          accessCode: newAccessCode,
          signedAt: null,
          viewedAt: null,
        },
      }),
      ...(approvalRecord && approvalSteps && approvalSteps.length > 0
        ? approvalSteps.map((step) =>
            db.approvalRecordStep.create({
              data: {
                recordId: approvalRecord.id,
                stepOrder: step.stepOrder,
                approverType: step.approverType,
                approverRoleId: step.approverRoleId,
                approverUserId: step.approverUserId,
                status: step.status,
                decidedById: step.decidedById,
                decidedAt: step.decidedAt,
                signature: step.signature,
                revisionId: newRevisionId,
              },
            }),
          )
        : []),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "booking.package_synced",
      result: "success",
      entityType: "booking",
      entityId: bookingId,
      changes: { packageId: masterPkg.id, packageName: masterPkg.packageName, newRevisionId, price: pkgPrice, reApproval: true },
      description: `Sync paket dari master: ${masterPkg.packageName} (${formatIdr(pkgPrice)}) — reset approval & TTD ulang`,
    });

    revalidateTag("bookings", "max");
    return { success: true };
  } catch (e) {
    console.error("[syncBookingPackage]", e);
    return { success: false, error: "Gagal sync paket dari master." };
  }
}

function formatIdr(n: number): string {
  return `Rp${new Intl.NumberFormat("id-ID").format(n)}`;
}
