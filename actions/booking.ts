"use server";

import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { notifySuperAdmins } from "@/lib/notifications";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { bookingSchema, updateBookingSchema, editBookingSchema } from "@/lib/validations/booking";
import { resolveApprovalSteps } from "@/lib/approval-flows";
import { getNextSequence } from "@/lib/counter";
import { createBookingRevision } from "@/lib/booking-revision";
import { resolveManagerId } from "@/lib/resolve-manager";
import { canAccessBooking, getProfileDataScope } from "@/lib/access-control";
import { generateEmaterai } from "@/lib/peruri";

export async function createBooking(data: unknown) {
  const { session, error } = await requirePermission({ module: "booking", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`booking-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = bookingSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const input = parsed.data;

  try {
    let customerId = input.customerId;
    let isNewCustomer = false;
    // leadId — set when booking is created from a Lead (not from existing Customer)
    const leadId = input.leadId ?? null;
    // When lead already converted → reuse existing customer; otherwise create new
    let leadRecord: { id: string; name: string; email: string | null; contactNumbers: unknown; address: string | null; bitrixId: string | null; sourceOfInformationId: string | null; convertedToCustomerId: string | null } | null = null;

    // Track whether this request "won" the first-conversion lock for a lead.
    // When true, the lead was already stamped with convertedToCustomerId before
    // the main transaction runs — no need to include the lead stamp in ops[].
    let didLockLeadConversion = false;

    if (leadId) {
      leadRecord = await db.lead.findUnique({
        where: { id: leadId },
        select: {
          id: true,
          name: true,
          email: true,
          contactNumbers: true,
          address: true,
          bitrixId: true,
          sourceOfInformationId: true,
          convertedToCustomerId: true,
        },
      });
      if (!leadRecord) return { success: false, error: "Lead tidak ditemukan." };

      if (leadRecord.convertedToCustomerId) {
        // Lead sudah pernah dikonversi — reuse existing customer
        customerId = leadRecord.convertedToCustomerId;
        const existing = await db.customer.findUnique({ where: { id: customerId }, select: { id: true } });
        if (!existing) return { success: false, error: "Customer dari lead tidak ditemukan." };
      } else {
        // Lead belum pernah dikonversi — buat customer baru dari data lead.
        //
        // Race-condition guard (optimistic lock):
        // Two concurrent requests both reading convertedToCustomerId=null would
        // both try to create a new customer and stamp the lead.
        // We prevent this by claiming the lock HERE, before the main transaction,
        // using updateMany(WHERE convertedToCustomerId IS NULL).
        // Only one request wins (count=1); the other gets count=0 → return early.
        // This means a duplicate customer is never created because we only generate
        // customerId and proceed to the transaction after winning the lock.
        customerId = crypto.randomUUID();
        const lockResult = await db.lead.updateMany({
          where: { id: leadRecord.id, convertedToCustomerId: null },
          data: { convertedToCustomerId: customerId },
        });
        if (lockResult.count === 0) {
          // Another concurrent request already converted this lead — re-read and reuse
          const refreshed = await db.lead.findUnique({
            where: { id: leadRecord.id },
            select: { convertedToCustomerId: true },
          });
          if (refreshed?.convertedToCustomerId) {
            customerId = refreshed.convertedToCustomerId;
            isNewCustomer = false;
            // Update leadRecord reference so downstream booking-pointer update works
            leadRecord = { ...leadRecord, convertedToCustomerId: customerId };
          } else {
            return { success: false, error: "Gagal mengkonversi lead, coba lagi." };
          }
        } else {
          isNewCustomer = true;
          didLockLeadConversion = true;
          // Update leadRecord reference so the stamp is not re-applied in ops[]
          leadRecord = { ...leadRecord, convertedToCustomerId: customerId };
        }
      }
    } else if (!customerId && input.customerName) {
      // Fallback: booking tanpa lead, tanpa existing customer — buat baru dari input manual
      customerId = crypto.randomUUID();
      isNewCustomer = true;
    } else if (customerId) {
      const existing = await db.customer.findUnique({ where: { id: customerId }, select: { id: true } });
      if (!existing) return { success: false, error: "Customer tidak ditemukan." };
    }

    if (!customerId) return { success: false, error: "Customer wajib diisi." };

    // ── Venue availability conflict check (WEDDINGS only — MICE has no weddingSession) ──
    if (input.weddingSession) {
      const bookingDateObj = new Date(input.bookingDate);
      const conflictingBooking = await db.booking.findFirst({
        where: {
          venueId: input.venueId,
          bookingDate: bookingDateObj,
          bookingStatus: { notIn: ["Canceled", "Lost"] },
          OR: input.weddingSession === "fullday"
            ? [
                { weddingSession: "morning" },
                { weddingSession: "evening" },
                { weddingSession: "fullday" },
              ]
            : [
                { weddingSession: input.weddingSession },
                { weddingSession: "fullday" },
              ],
        },
        select: { id: true },
      });
      if (conflictingBooking) {
        return { success: false, error: "Slot venue di tanggal & sesi tersebut sudah dibooking." };
      }
    }

    let emateraiResult: { sn: string; qrBase64: string } | null = null;

    // Resolve "Deal" lead status (system final) — used when booking is created from a lead
    const convertedStatus = leadRecord
      ? await db.leadStatus.findFirst({
          where: { isSystem: true, isFinal: true },
          select: { id: true },
        })
      : null;

    // Fetch data needed for transaction — for new customers, build from input
    const [existingCustomer, venue, pkg] = await Promise.all([
      isNewCustomer ? null : db.customer.findUniqueOrThrow({ where: { id: customerId } }),
      db.venue.findUniqueOrThrow({ where: { id: input.venueId }, include: { brand: true } }),
      db.package.findUniqueOrThrow({
        where: { id: input.packageId },
        include: { vendorItems: true, internalItems: true, categoryPrices: true },
      }),
    ]);

    // Map lead contactNumbers format { label, number } → customer format { name, number }
    function mapLeadContactNumbers(raw: unknown): Array<{ name: string; number: string }> {
      if (!Array.isArray(raw)) return [];
      return (raw as Array<Record<string, unknown>>).map((e) => ({
        name: typeof e.label === "string" ? e.label : typeof e.name === "string" ? e.name : "",
        number: typeof e.number === "string" ? e.number : "",
      })).filter((e) => e.number);
    }

    // Build customer data (from input for new/lead-from-input, from DB for existing)
    const customerData = isNewCustomer
      ? leadRecord
        ? {
            // Customer baru dari lead data
            id: customerId,
            name: leadRecord.name,
            mobileNumber: mapLeadContactNumbers(leadRecord.contactNumbers),
            email: leadRecord.email || "-@placeholder.com",
            nikNumber: null as string | null,
            ktpAddress: leadRecord.address ?? null,
          }
        : {
            // Customer baru dari input manual (fallback path)
            id: customerId,
            name: input.customerName!,
            mobileNumber: parseContactNumbersToArray(input.contactNumbers ?? ""),
            email: input.contactEmail || "-@placeholder.com",
            nikNumber: input.contactNik || null,
            ktpAddress: input.contactKtpAddress || null,
          }
      : {
          id: existingCustomer!.id,
          name: existingCustomer!.name,
          mobileNumber: existingCustomer!.mobileNumber,
          email: existingCustomer!.email,
          nikNumber: existingCustomer!.nikNumber,
          ktpAddress: existingCustomer!.ktpAddress,
        };

    const bookingId = crypto.randomUUID();

    // Generate PO Number: {counter}/{brandCode}/{venueCode}/{eventTypeCode}/{dd-mm-yyyy}
    const now = new Date();
    const year = now.getFullYear();
    const poSeq = await getNextSequence(`po-${year}`);
    const dd = now.getDate().toString().padStart(2, "0");
    const mm = (now.getMonth() + 1).toString().padStart(2, "0");
    const eventTypeCode = input.weddingType ?? "R";
    const poNumber = `${poSeq.toString().padStart(3, "0")}/${venue.brand?.code ?? ""}/${venue.code}/${eventTypeCode}/${dd}-${mm}-${year}`;

    const ROMAN = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];

    // Generate invoice numbers atomically before transaction
    let invoiceNumbers: string[] = [];
    if (input.termOfPayments && input.termOfPayments.length > 0) {
      const monthRoman = ROMAN[now.getMonth()];
      invoiceNumbers = await Promise.all(
        input.termOfPayments.map(async () => {
          const seq = await getNextSequence(`invoice-${year}`);
          return `${seq}/INV/${venue.code}/${monthRoman}/${year}`;
        })
      );
    }

    if (input.withMaterai) {
      emateraiResult = await generateEmaterai(poNumber, new Date(input.bookingDate));
    }

    // Resolve hardcoded approval flow: Manager (step 1) → Finance (step 2)
    const bookingApprovalSteps = await resolveApprovalSteps("booking");

    // Build array-form transaction — customer create/update included for atomicity
    const ops: Prisma.PrismaPromise<unknown>[] = [];

    if (isNewCustomer) {
      if (leadRecord) {
        // Create customer from lead data — mapping contactNumbers label→name
        ops.push(
          db.customer.create({
            data: {
              id: customerId,
              name: leadRecord.name,
              mobileNumber: mapLeadContactNumbers(leadRecord.contactNumbers) as Prisma.InputJsonValue,
              email: leadRecord.email || "-@placeholder.com",
              nikNumber: null,
              ktpAddress: leadRecord.address ?? null,
              bitrixId: leadRecord.bitrixId ?? null,
              sourceOfInformationId: leadRecord.sourceOfInformationId ?? null,
              type: "Other",
              memberStatus: "Non-Member",
              updatedBy: session!.user.name ?? session!.user.email,
            },
          })
        );
      } else {
        // Create customer from manual input (fallback path — no lead)
        ops.push(
          db.customer.create({
            data: {
              id: customerId,
              name: input.customerName!,
              mobileNumber: parseContactNumbersToArray(input.contactNumbers ?? "") as Prisma.InputJsonValue,
              email: input.contactEmail || "-@placeholder.com",
              nikNumber: input.contactNik || null,
              ktpAddress: input.contactKtpAddress || null,
              bitrixId: input.contactBitrixId || null,
              type: "Other",
              memberStatus: "Non-Member",
              updatedBy: session!.user.name ?? session!.user.email,
            },
          })
        );
      }
    } else {
      const updates: Record<string, unknown> = {};
      if (input.contactNumbers) updates.mobileNumber = parseContactNumbersToArray(input.contactNumbers) as Prisma.InputJsonValue;
      if (input.contactEmail) updates.email = input.contactEmail;
      if (input.contactNik) updates.nikNumber = input.contactNik;
      if (input.contactKtpAddress) updates.ktpAddress = input.contactKtpAddress;
      if (input.contactBitrixId) updates.bitrixId = input.contactBitrixId;
      if (Object.keys(updates).length > 0) {
        updates.updatedBy = session!.user.name ?? session!.user.email;
        ops.push(db.customer.update({ where: { id: customerId }, data: updates }));
      }
    }

    // If booking created from a lead → update lead.convertedTo* fields atomically.
    // convertedToCustomerId is already stamped outside via optimistic lock (didLockLeadConversion),
    // so here we only need to:
    //   • stamp convertedAt + convertedToBookingId + statusId for first conversion
    //   • stamp convertedToBookingId + statusId for already-converted leads
    if (leadRecord) {
      const leadUpdateData: Record<string, unknown> = {
        convertedToBookingId: bookingId,
      };
      if (didLockLeadConversion) {
        // First conversion — stamp timestamp (convertedToCustomerId already set above)
        leadUpdateData.convertedAt = new Date();
      }
      if (convertedStatus) {
        leadUpdateData.statusId = convertedStatus.id;
      }
      ops.push(
        db.lead.update({
          where: { id: leadRecord.id },
          data: leadUpdateData,
        })
      );
    }

    // Sales auto-detect: use explicit salesId if provided (admin/manager
    // assigning on behalf), otherwise fall back to the caller's own profile.
    const salesId = input.salesId ?? session!.user.profileId!;

    ops.push(
      db.booking.create({
        data: {
          id: bookingId,
          bookingDate: new Date(input.bookingDate),
          salesId,
          managerId: await resolveManagerId(salesId),
          customerId,
          venueId: input.venueId,
          packageId: input.packageId,
          paymentMethodId: input.paymentMethodId ?? null,
          sourceOfInformationId: input.sourceOfInformationId ?? null,
          weddingSession: input.weddingSession ?? null,
          weddingType: input.weddingType ?? null,
          signingLocation: input.signingLocation ?? null,
          discountName: input.specialBonusName ?? null,
          discountAmount: input.specialBonusAmount ?? 0,
          withMaterai: input.withMaterai ?? false,
          poNumber,
        },
      }),
      db.snapCustomer.create({
        data: {
          bookingId,
          customerId: customerData.id,
          name: customerData.name,
          email: customerData.email,
          mobileNumber: Array.isArray(customerData.mobileNumber)
            ? (customerData.mobileNumber as Array<{ name?: string; number: string }>)
                .map((e) => (e.name ? `${e.name}: ${e.number}` : e.number))
                .join(", ")
            : String(customerData.mobileNumber ?? ""),
          nikNumber: customerData.nikNumber,
          ktpAddress: customerData.ktpAddress,
        },
      }),
      db.snapVenue.create({
        data: {
          bookingId,
          venueId: venue.id,
          venueName: venue.name,
          address: venue.address,
          description: venue.description,
          brandName: venue.brand?.name ?? null,
          brandCode: venue.brand?.code ?? null,
        },
      }),
      db.snapPackage.create({
        data: {
          bookingId,
          packageId: pkg.id,
          packageName: pkg.packageName,
          notes: pkg.notes,
        },
      }),
    );

    // Snapshot package pax + pricing (with takeout toggle support)
    {
      const toggleMap = new Map(
        (input.categoryToggles ?? []).map((t) => [t.categoryName, t.isTakeout])
      );
      // Resolve which category IDs are taken out, so vendor items can carry the flag
      // directly (matching by categoryId, not fragile categoryName string).
      const takeoutCategoryIds = new Set(
        pkg.categoryPrices
          .filter((c) => c.isShow && (toggleMap.get(c.categoryName) ?? false) && c.categoryId)
          .map((c) => c.categoryId as string),
      );
      // Hidden categories (isShow=false) always included; visible ones respect isTakeout toggle
      const hasTakeout = (input.categoryToggles ?? []).some((t) => t.isTakeout);
      const pkgBase = pkg.categoryPrices.reduce((sum, c) => {
        if (!c.isShow) return sum + c.basePrice;
        const isTakeout = toggleMap.get(c.categoryName) ?? false;
        return isTakeout ? sum : sum + c.basePrice;
      }, 0);
      const pkgPrice = (!hasTakeout && pkg.sellingPrice > 0)
        ? pkg.sellingPrice
        : pkgBase + Math.round(pkgBase * ((pkg.margin ?? 0) / 100));

      ops.push(
        db.snapPackagePricing.create({
          data: {
            bookingId,
            packageId: pkg.id,
            packageName: pkg.packageName,
            pax: pkg.pax,
            price: pkgPrice,
            margin: pkg.margin ?? 0,
            termAndCondition: pkg.termAndCondition ?? null,
          },
        })
      );
      if (pkg.internalItems.length > 0) {
        ops.push(
          ...pkg.internalItems.map((item, i) =>
            db.snapPackageInternalItem.create({ data: { bookingId, itemName: item.itemName, itemDescription: item.itemDescription, sortOrder: i } })
          )
        );
      }
      if (pkg.vendorItems.length > 0) {
        ops.push(
          ...pkg.vendorItems.map((item, i) =>
            db.snapPackageVendorItem.create({
              data: {
                bookingId,
                categoryId: item.categoryId ?? null,
                categoryName: item.categoryName,
                itemText: item.itemText,
                sortOrder: i,
                isTakeout: item.categoryId ? takeoutCategoryIds.has(item.categoryId) : false,
              },
            })
          )
        );
      }
      if (pkg.categoryPrices.length > 0) {
        ops.push(
          ...pkg.categoryPrices.map((cp) =>
            db.snapPackageCategoryPrice.create({
              data: {
                bookingId,
                categoryId: cp.categoryId ?? null,
                categoryName: cp.categoryName,
                basePrice: cp.basePrice,
                sortOrder: cp.sortOrder,
                isShow: cp.isShow,
                isTakeout: cp.isShow ? (toggleMap.get(cp.categoryName) ?? false) : false,
              },
            })
          )
        );
      }
    }

    if (input.bonuses && input.bonuses.length > 0) {
      ops.push(
        ...input.bonuses.map((bonus) =>
          db.snapBonus.create({ data: { bookingId, vendorId: bonus.vendorId, vendorCategoryId: bonus.vendorCategoryId, vendorName: bonus.vendorName, description: bonus.description ?? null, qty: bonus.qty, nominal: bonus.nominal ?? 0 } })
        )
      );
    }

    if (input.termOfPayments && input.termOfPayments.length > 0) {
      ops.push(
        ...input.termOfPayments.map((t, i) =>
          db.termOfPayment.create({ data: { bookingId, name: t.name, amount: t.amount, dueDate: new Date(t.dueDate), sortOrder: t.sortOrder, invoiceNumber: invoiceNumbers[i], paymentStatus: (t.paymentStatus ?? "unpaid") as "unpaid" | "paid" | "partial" | "refund" } })
        )
      );
    }

    // Add ApprovalRecord + steps to the same transaction (hardcoded: Manager → Finance)
    if (bookingApprovalSteps && bookingApprovalSteps.length > 0) {
      const approvalRecordId = crypto.randomUUID();
      const creatorRoleId = session!.user.roleId;
      const creatorStepIdx = bookingApprovalSteps.findIndex(
        (s) => s.approverType === "role" && s.approverRoleId === creatorRoleId
      );

      ops.push(
        db.approvalRecord.create({
          data: {
            id: approvalRecordId,
            module: "booking",
            entityId: bookingId,
            status: "pending",
            createdById: session!.user.profileId!,
            emateraiSn: emateraiResult?.sn ?? null,
            emateraiQrBase64: emateraiResult?.qrBase64 ?? null,
          },
        }),
        ...bookingApprovalSteps.map((step, i) => {
          // Auto-approve ONLY the step whose approverRoleId matches the creator's role.
          // Finance creating → only Finance step auto-approved; Manager still pending.
          // Role lain → semua pending.
          const shouldAutoApprove = creatorStepIdx >= 0 && i === creatorStepIdx;
          return db.approvalRecordStep.create({
            data: {
              recordId: approvalRecordId,
              stepOrder: step.sortOrder,
              approverType: step.approverType,
              approverRoleId: step.approverRoleId,
              approverUserId: null,
              status: shouldAutoApprove ? "approved" : "pending",
              decidedById: shouldAutoApprove ? session!.user.profileId! : null,
              decidedAt: shouldAutoApprove ? new Date() : null,
              signature: shouldAutoApprove ? (input.signatureSales ?? null) : null,
            },
          });
        })
      );
    }

    ops.push(
      db.clientAgreement.create({
        data: {
          bookingId,
          token: crypto.randomUUID(),
          accessCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      })
    );

    await db.$transaction(ops);

    await logAudit({
      userId: session!.user.id,
      action: "created",
      entityType: "booking",
      entityId: bookingId,
      changes: { customerId, venueId: input.venueId, packageId: input.packageId, withMaterai: input.withMaterai ?? false, ...(leadId ? { leadId } : {}) },
      description: `Created booking for ${customerData.name}${leadId ? " (from lead)" : ""}`,
    });

    // Create initial PO revision snapshot + link approval steps
    const revisionId = await createBookingRevision(bookingId, session!.user.profileId!, "Initial booking");
    await db.approvalRecordStep.updateMany({
      where: { record: { module: "booking", entityId: bookingId } },
      data: { revisionId },
    });

    revalidateTag("bookings", "max");
    revalidateTag("customers", "max");
    if (leadRecord) revalidateTag("leads", "max");

    // Notify all super admins about new booking (exclude creator)
    notifySuperAdmins({
      title: "Booking Baru",
      message: `${session!.user.name ?? "User"} membuat booking untuk ${customerData.name}.`,
      type: "booking_created",
      entityType: "booking",
      entityId: bookingId,
    }, session!.user.profileId!);

    // Fetch created term IDs for client-side evidence upload
    const createdTerms = await db.termOfPayment.findMany({
      where: { bookingId },
      select: { id: true, sortOrder: true },
      orderBy: { sortOrder: "asc" },
    });

    return { success: true, bookingId, termIds: createdTerms };
  } catch (e) {
    console.error("[createBooking]", e);
    return { success: false, error: "Gagal membuat booking." };
  }
}

/**
 * Serialize wire-format contactNumbers (JSON string of MobileNumberEntry[]) to
 * the display string persisted in `snapCustomer.mobileNumber`.
 *
 * Wire format: JSON.stringify([{ name: string; number: string }, ...])
 * Persisted format: "name: number, name: number" (name omitted when empty)
 *
 * Returns empty string on parse failure (safe fallback).
 */
function serializeContactNumbersToDisplay(contactNumbers: string): string {
  if (!contactNumbers) return "";
  try {
    const arr = JSON.parse(contactNumbers) as Array<{ name?: string; number: string }>;
    if (!Array.isArray(arr)) return "";
    return arr.map((e) => (e.name ? `${e.name}: ${e.number}` : e.number)).join(", ");
  } catch {
    return "";
  }
}

/**
 * Parse wire-format contactNumbers (JSON string) to structured array for
 * storage in `customer.mobileNumber` (Json column).
 *
 * Returns empty array on parse failure (safe fallback).
 */
function parseContactNumbersToArray(contactNumbers: string): Array<{ name: string; number: string }> {
  if (!contactNumbers) return [];
  try {
    const arr = JSON.parse(contactNumbers) as Array<{ name?: string; number: string }>;
    if (!Array.isArray(arr)) return [];
    return arr.map((e) => ({ name: e.name ?? "", number: e.number }));
  } catch {
    return [];
  }
}

export async function updateBooking(data: unknown) {
  const parsed = updateBookingSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { id, ...rest } = parsed.data;

  // Determine required permission based on status change
  const statusActionMap: Record<string, string> = {
    Rejected: "reject",
    Lost: "mark-lost",
    Pending: "restore",
  };
  const requiredAction = rest.bookingStatus ? (statusActionMap[rest.bookingStatus] ?? "edit") : "edit";

  const { session, error } = await requirePermission({ module: "booking", action: requiredAction });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`booking-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const scope = await getProfileDataScope(session!.user.profileId);
  if (!(await canAccessBooking(session!.user.profileId, scope, id))) {
    return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
  }

  try {
    const updateData: Record<string, unknown> = {};
    if (rest.bookingDate) updateData.bookingDate = new Date(rest.bookingDate);
    if (rest.bookingStatus !== undefined) updateData.bookingStatus = rest.bookingStatus;
    if (rest.paymentStatus !== undefined) updateData.paymentStatus = rest.paymentStatus;
    if (rest.weddingSession !== undefined) updateData.weddingSession = rest.weddingSession;
    if (rest.weddingType !== undefined) updateData.weddingType = rest.weddingType;
    if (rest.rejectionNotes !== undefined) updateData.rejectionNotes = rest.rejectionNotes;
    if (rest.lostReason !== undefined) updateData.lostReason = rest.lostReason;
    if (rest.paymentMethodId !== undefined) updateData.paymentMethodId = rest.paymentMethodId;
    if (rest.sourceOfInformationId !== undefined) updateData.sourceOfInformationId = rest.sourceOfInformationId;

    await db.$transaction([db.booking.update({ where: { id }, data: updateData })]);

    await logAudit({
      userId: session!.user.id,
      action: "updated",
      entityType: "booking",
      entityId: id,
      changes: rest,
      description: `Updated booking`,
    });

    revalidateTag("bookings", "max");

    return { success: true };
  } catch {
    return { success: false, error: "Gagal memperbarui booking." };
  }
}

export async function deleteBooking(id: string) {
  const { session, error } = await requirePermission({ module: "booking", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`booking-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const scope = await getProfileDataScope(session!.user.profileId);
  if (!(await canAccessBooking(session!.user.profileId, scope, id))) {
    return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
  }

  try {
    // Fetch R2 file keys before deleting records
    const docs = await db.bookingDocument.findMany({
      where: { bookingId: id },
      select: { filePath: true },
    });

    await db.$transaction([
      // Cleanup non-FK relations (module + entityId pattern)
      db.approvalRecordStep.deleteMany({
        where: { record: { module: "booking", entityId: id } },
      }),
      db.approvalRecord.deleteMany({
        where: { module: "booking", entityId: id },
      }),
      db.notification.deleteMany({
        where: { entityType: "booking", entityId: id },
      }),
      db.activityLog.deleteMany({
        where: { entityType: "booking", entityId: id },
      }),
      // Cascade handles the rest (snaps, terms, comments, etc.)
      db.booking.delete({ where: { id } }),
    ]);

    // Delete R2 files (outside transaction — non-critical)
    if (docs.length > 0) {
      const { deleteFromR2 } = await import("@/lib/r2");
      await Promise.all(
        docs.map((d) => deleteFromR2(d.filePath).catch((e) => console.error("[deleteBooking] R2:", e)))
      );
    }

    await logAudit({
      userId: session!.user.id,
      action: "deleted",
      entityType: "booking",
      entityId: id,
      description: "Deleted booking",
    });

    revalidateTag("bookings", "max");
    return { success: true };
  } catch {
    return { success: false, error: "Gagal menghapus booking." };
  }
}

export async function transferBooking(bookingId: string, targetSalesId: string) {
  const { session, error } = await requirePermission({ module: "booking", action: "transfer" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`booking-transfer:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  if (!bookingId || !targetSalesId) return { success: false, error: "Parameter tidak valid." };

  const scope = await getProfileDataScope(session!.user.profileId);
  if (!(await canAccessBooking(session!.user.profileId, scope, bookingId))) {
    return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
  }

  try {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: { salesId: true, sales: { select: { fullName: true } } },
    });
    if (!booking) return { success: false, error: "Booking tidak ditemukan." };

    const targetSales = await db.profile.findUnique({
      where: { id: targetSalesId },
      select: { fullName: true },
    });
    if (!targetSales) return { success: false, error: "Sales tujuan tidak ditemukan." };

    await db.$transaction([db.booking.update({ where: { id: bookingId }, data: { salesId: targetSalesId } })]);

    await logAudit({
      userId: session!.user.id,
      action: "updated",
      entityType: "booking",
      entityId: bookingId,
      changes: {
        salesId: { from: booking.salesId, to: targetSalesId },
        fromSales: booking.sales?.fullName ?? "Unknown",
        toSales: targetSales.fullName,
      },
      description: `Transfer booking dari ${booking.sales?.fullName ?? "Unknown"} ke ${targetSales.fullName}`,
    });

    revalidateTag("bookings", "max");
    return { success: true };
  } catch {
    return { success: false, error: "Gagal mentransfer booking." };
  }
}

export async function editBooking(data: unknown) {
  const { session, error } = await requirePermission({ module: "booking", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`booking-edit:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = editBookingSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { id, customerName, contactNumbers, contactEmail, contactNik, contactKtpAddress, contactBitrixId, ...rest } = parsed.data;

  const scope = await getProfileDataScope(session!.user.profileId);
  if (!(await canAccessBooking(session!.user.profileId, scope, id))) {
    return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
  }

  try {
    const booking = await db.booking.findUnique({
      where: { id },
      select: { customerId: true, venueId: true, packageId: true, bookingDate: true, weddingSession: true, weddingType: true, paymentMethodId: true, sourceOfInformationId: true, discountName: true, discountAmount: true, snapCustomer: { select: { name: true, mobileNumber: true, email: true } } },
    });
    if (!booking) return { success: false, error: "Booking tidak ditemukan." };

    // ── Venue availability conflict check (WEDDINGS only — MICE has no weddingSession) ──
    // Exclude the current booking so it doesn't conflict with itself.
    if (rest.weddingSession) {
      const bookingDateObj = new Date(rest.bookingDate);
      const conflictingBooking = await db.booking.findFirst({
        where: {
          id: { not: id },
          venueId: rest.venueId,
          bookingDate: bookingDateObj,
          bookingStatus: { notIn: ["Canceled", "Lost"] },
          OR: rest.weddingSession === "fullday"
            ? [
                { weddingSession: "morning" },
                { weddingSession: "evening" },
                { weddingSession: "fullday" },
              ]
            : [
                { weddingSession: rest.weddingSession },
                { weddingSession: "fullday" },
              ],
        },
        select: { id: true },
      });
      if (conflictingBooking) {
        return { success: false, error: "Slot venue di tanggal & sesi tersebut sudah dibooking." };
      }
    }

    const venueChanged = rest.venueId !== booking.venueId;
    const packageChanged = rest.packageId !== booking.packageId;

    // Fetch old snap names for activity log (before transaction overwrites them)
    const [oldSnapVenue, oldSnapPackage, oldSnapVariant] = await Promise.all([
      db.snapVenue.findUnique({ where: { bookingId: id }, select: { venueName: true } }),
      db.snapPackage.findUnique({ where: { bookingId: id }, select: { packageName: true } }),
      db.snapPackagePricing.findUnique({ where: { bookingId: id }, select: { packageName: true, pax: true, price: true } }),
    ]);

    const ops: Prisma.PrismaPromise<unknown>[] = [
      // Update booking
      db.booking.update({
        where: { id },
        data: {
          bookingDate: new Date(rest.bookingDate),
          venueId: rest.venueId,
          packageId: rest.packageId,
          paymentMethodId: rest.paymentMethodId ?? null,
          sourceOfInformationId: rest.sourceOfInformationId ?? null,
          weddingSession: rest.weddingSession ?? null,
          weddingType: rest.weddingType ?? null,
          signingLocation: rest.signingLocation ?? null,
          discountName: rest.specialBonusName ?? null,
          discountAmount: rest.specialBonusAmount ?? 0,
        },
      }),
      // Update customer snapshot
      db.snapCustomer.update({
        where: { bookingId: id },
        data: {
          name: customerName,
          // snapCustomer.mobileNumber persists as display string: "name: number, ..."
          mobileNumber: serializeContactNumbersToDisplay(contactNumbers ?? "") || "-",
          email: contactEmail || "-@placeholder.com",
          nikNumber: contactNik || null,
          ktpAddress: contactKtpAddress || null,
        },
      }),
      // Update actual customer — mobileNumber is a Json column (structured array)
      db.customer.update({
        where: { id: booking.customerId },
        data: {
          name: customerName,
          mobileNumber: parseContactNumbersToArray(contactNumbers ?? "") as Prisma.InputJsonValue,
          email: contactEmail || "-@placeholder.com",
          nikNumber: contactNik || null,
          ktpAddress: contactKtpAddress || null,
          bitrixId: contactBitrixId || null,
          updatedBy: session!.user.name ?? session!.user.email,
        },
      }),
    ];

    // Update venue snapshot if venue changed
    if (venueChanged) {
      const venue = await db.venue.findUniqueOrThrow({
        where: { id: rest.venueId },
        include: { brand: true },
      });
      ops.push(
        db.snapVenue.update({
          where: { bookingId: id },
          data: {
            venueId: venue.id,
            venueName: venue.name,
            address: venue.address,
            description: venue.description,
            brandName: venue.brand?.name ?? null,
            brandCode: venue.brand?.code ?? null,
          },
        })
      );
    }

    // Update package snapshots if package changed
    if (packageChanged) {
      const newPkg = await db.package.findUniqueOrThrow({
        where: { id: rest.packageId },
        include: { vendorItems: true, internalItems: true, categoryPrices: true },
      });
      ops.push(
        db.snapPackage.update({
          where: { bookingId: id },
          data: { packageId: newPkg.id, packageName: newPkg.packageName, notes: newPkg.notes },
        })
      );

      // Apply takeout toggles to price calculation
      const toggleMap = new Map(
        (parsed.data.categoryToggles ?? []).map((t) => [t.categoryName, t.isTakeout])
      );
      const takeoutCategoryIds = new Set(
        newPkg.categoryPrices
          .filter((c) => c.isShow && (toggleMap.get(c.categoryName) ?? false) && c.categoryId)
          .map((c) => c.categoryId as string),
      );
      const hasTakeout = (parsed.data.categoryToggles ?? []).some((t) => t.isTakeout);
      const pkgBase = newPkg.categoryPrices.reduce((sum, c) => {
        if (!c.isShow) return sum + c.basePrice;
        const isTakeout = toggleMap.get(c.categoryName) ?? false;
        return isTakeout ? sum : sum + c.basePrice;
      }, 0);
      const pkgPrice = (!hasTakeout && newPkg.sellingPrice > 0)
        ? newPkg.sellingPrice
        : pkgBase + Math.round(pkgBase * ((newPkg.margin ?? 0) / 100));

      ops.push(
        db.snapPackagePricing.upsert({
          where: { bookingId: id },
          create: {
            bookingId: id,
            packageId: newPkg.id,
            packageName: newPkg.packageName,
            pax: newPkg.pax,
            price: pkgPrice,
            margin: newPkg.margin ?? 0,
            termAndCondition: newPkg.termAndCondition ?? null,
          },
          update: {
            packageId: newPkg.id,
            packageName: newPkg.packageName,
            pax: newPkg.pax,
            price: pkgPrice,
            margin: newPkg.margin ?? 0,
            termAndCondition: newPkg.termAndCondition ?? null,
          },
        }),
        db.snapPackageInternalItem.deleteMany({ where: { bookingId: id } }),
        db.snapPackageVendorItem.deleteMany({ where: { bookingId: id } }),
        db.snapPackageCategoryPrice.deleteMany({ where: { bookingId: id } }),
        ...newPkg.internalItems.map((item, i) =>
          db.snapPackageInternalItem.create({ data: { bookingId: id, itemName: item.itemName, itemDescription: item.itemDescription, sortOrder: i } })
        ),
        ...newPkg.vendorItems.map((item, i) =>
          db.snapPackageVendorItem.create({
            data: {
              bookingId: id,
              categoryId: item.categoryId ?? null,
              categoryName: item.categoryName,
              itemText: item.itemText,
              sortOrder: i,
              isTakeout: item.categoryId ? takeoutCategoryIds.has(item.categoryId) : false,
            },
          })
        ),
        ...newPkg.categoryPrices.map((cp) =>
          db.snapPackageCategoryPrice.create({
            data: {
              bookingId: id,
              categoryId: cp.categoryId ?? null,
              categoryName: cp.categoryName,
              basePrice: cp.basePrice,
              sortOrder: cp.sortOrder,
              isShow: cp.isShow,
              isTakeout: cp.isShow ? (toggleMap.get(cp.categoryName) ?? false) : false,
            },
          })
        )
      );
    }

    // Bonuses — replace existing atomically within transaction
    if (parsed.data.bonuses && parsed.data.bonuses.length > 0) {
      ops.push(
        db.snapBonus.deleteMany({ where: { bookingId: id } }),
        ...parsed.data.bonuses.map((bonus) =>
          db.snapBonus.create({ data: { bookingId: id, vendorId: bonus.vendorId, vendorCategoryId: bonus.vendorCategoryId, vendorName: bonus.vendorName, description: bonus.description ?? null, qty: bonus.qty, nominal: bonus.nominal ?? 0 } })
        )
      );
    }

    // Term of payments — upsert atomically within transaction
    if ((venueChanged || packageChanged) && rest.termOfPayments && rest.termOfPayments.length > 0) {
      const existingTermIds = rest.termOfPayments.filter((t) => t.id).map((t) => t.id!);
      ops.push(
        db.termOfPayment.deleteMany({ where: { bookingId: id, id: { notIn: existingTermIds } } }),
        ...rest.termOfPayments.map((t) => {
          if (t.id) {
            return db.termOfPayment.update({ where: { id: t.id }, data: { name: t.name, amount: t.amount, dueDate: new Date(t.dueDate), sortOrder: t.sortOrder } });
          }
          return db.termOfPayment.create({ data: { bookingId: id, name: t.name, amount: t.amount, dueDate: new Date(t.dueDate), sortOrder: t.sortOrder } });
        })
      );
    }

    await db.$transaction(ops);

    // Reset approval + create revision — only when package or venue changed
    if (venueChanged || packageChanged) {
    const reasons: string[] = [];
    if (venueChanged) reasons.push("venue");
    if (packageChanged) reasons.push("package");
    const revisionId = await createBookingRevision(id, session!.user.profileId!, `Changed ${reasons.join(", ")}`);

    const approvalRecord = await db.approvalRecord.findUnique({
      where: { module_entityId: { module: "booking", entityId: id } },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
    if (approvalRecord) {
      // Resolve hardcoded approval flow: Manager (step 1) → Finance (step 2)
      const editApprovalSteps = await resolveApprovalSteps("booking");

      if (editApprovalSteps && editApprovalSteps.length > 0) {
        const creatorRoleId = session!.user.roleId;
        const creatorStepIdx = editApprovalSteps.findIndex(
          (s) => s.approverType === "role" && s.approverRoleId === creatorRoleId
        );

        const newStepOps: Prisma.PrismaPromise<unknown>[] = editApprovalSteps.map((flowStep, i) => {
          // Auto-approve ONLY the step whose approverRoleId matches the editor's role.
          const shouldAutoApprove = creatorStepIdx >= 0 && i === creatorStepIdx;
          return db.approvalRecordStep.create({
            data: {
              recordId: approvalRecord.id,
              stepOrder: flowStep.sortOrder,
              approverType: flowStep.approverType,
              approverRoleId: flowStep.approverRoleId,
              approverUserId: null,
              status: shouldAutoApprove ? "approved" : "pending",
              decidedById: shouldAutoApprove ? session!.user.profileId : null,
              decidedAt: shouldAutoApprove ? new Date() : null,
              signature: shouldAutoApprove ? (rest.signatureSales ?? null) : null,
              revisionId,
            },
          });
        });

        await db.$transaction([
          db.approvalRecordStep.deleteMany({ where: { recordId: approvalRecord.id } }),
          db.approvalRecord.update({ where: { id: approvalRecord.id }, data: { status: "pending" } }),
          db.booking.update({ where: { id }, data: { bookingStatus: "Pending" } }),
          ...newStepOps,
        ]);
      }

      // Reset client agreement — invalidate old link, generate new token
      const newToken = crypto.randomUUID();
      const newAccessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      await db.clientAgreement.updateMany({
        where: { bookingId: id },
        data: { status: "Pending", signedAt: null, viewedAt: null, token: newToken, accessCode: newAccessCode, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      });
    }
    } // end if venueChanged || packageChanged

    await logAudit({
      userId: session!.user.id,
      action: "updated",
      entityType: "booking",
      entityId: id,
      changes: await (async () => {
        const diff: Record<string, unknown> = {};
        const fmtNum = (n: number) => `Rp${new Intl.NumberFormat("id-ID").format(n)}`;

        if (customerName !== (booking.snapCustomer?.name ?? "")) diff.customerName = customerName;
        const oldContact = booking.snapCustomer?.mobileNumber ?? "";
        const newContact = contactNumbers ? serializeContactNumbersToDisplay(contactNumbers) : "";
        if (newContact !== oldContact) diff.contactNumbers = newContact;
        if (contactEmail !== (booking.snapCustomer?.email ?? "")) diff.email = contactEmail;
        if (rest.bookingDate !== booking.bookingDate.toISOString().split("T")[0]) diff.bookingDate = rest.bookingDate;
        if ((rest.weddingSession ?? "") !== (booking.weddingSession ?? "")) diff.weddingSession = rest.weddingSession;
        if ((rest.weddingType ?? "") !== (booking.weddingType ?? "")) diff.weddingType = rest.weddingType;

        if (venueChanged || packageChanged) {
          // New snap values (already updated by transaction)
          const [newSnapV, newSnapP, newSnapPV] = await Promise.all([
            db.snapVenue.findUnique({ where: { bookingId: id }, select: { venueName: true } }),
            db.snapPackage.findUnique({ where: { bookingId: id }, select: { packageName: true } }),
            db.snapPackagePricing.findUnique({ where: { bookingId: id }, select: { packageName: true, pax: true, price: true } }),
          ]);
          if (venueChanged) diff.venue = `${oldSnapVenue?.venueName ?? "—"} → ${newSnapV?.venueName ?? rest.venueId}`;
          if (packageChanged) {
            const oldP = oldSnapPackage?.packageName ?? "—";
            const newP = newSnapP?.packageName ?? rest.packageId;
            diff.package = `${oldP} → ${newP}`;
            if (newSnapPV) {
              const oldPV = oldSnapVariant ? `${oldSnapVariant.pax} PAX · ${fmtNum(oldSnapVariant.price)}` : "—";
              const newPV = `${newSnapPV.pax} PAX · ${fmtNum(newSnapPV.price)}`;
              diff.packagePricing = `${oldPV} → ${newPV}`;
            }
          }
          const discount = rest.specialBonusAmount ?? 0;
          const oldDiscount = booking.discountAmount ?? 0;
          if (discount !== oldDiscount) {
            diff.discount = `${fmtNum(oldDiscount)} → ${rest.specialBonusName ?? "Discount"}: -${fmtNum(discount)}`;
            const newPrice = newSnapPV?.price ?? 0;
            diff.priceAfterDiscount = fmtNum(Math.max(0, newPrice - discount));
          }
        }

        return diff;
      })(),
      description: `Edited booking for ${customerName}`,
    });

    revalidateTag("bookings", "max");
    revalidateTag("customers", "max");
    return { success: true };
  } catch {
    return { success: false, error: "Gagal mengupdate booking." };
  }
}

// ─── Approve Booking ──────────────────────────────────────────────────────────

export async function approveBooking(bookingId: string) {
  const { session, error } = await requirePermission({ module: "booking", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`booking-approve:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const scope = await getProfileDataScope(session!.user.profileId);
  if (!(await canAccessBooking(session!.user.profileId, scope, bookingId))) {
    return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
  }

  try {
    const [booking] = await db.$transaction([
      db.booking.update({
        where: { id: bookingId },
        data: { managerId: session!.user.profileId },
      }),
    ]);

    revalidateTag("groups", "max");
    revalidateTag("bookings", "max");

    const h = await headers();
    await logAudit({
      userId: session!.user.profileId,
      action: "booking.approved",
      entityType: "booking",
      entityId: bookingId,
      description: `Booking disetujui oleh manager`,
      ipAddress: h.get("x-forwarded-for") ?? undefined,
      userAgent: h.get("user-agent") ?? undefined,
    });

    return { success: true, booking };
  } catch (e) {
    console.error("[approveBooking]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

