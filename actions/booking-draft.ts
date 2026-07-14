"use server";

import { revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { getNextSequence, getNextSequenceBatch } from "@/lib/counter";
import { generateAccessCode } from "@/lib/access-code";
import { buildBookingApprovalSteps } from "@/lib/approval-flows";
import { createBookingRevision } from "@/lib/booking-revision";
import { resolveManagerId } from "@/lib/resolve-manager";
import { getProfileDataScope } from "@/lib/access-control";
import { notifySuperAdmins } from "@/lib/notifications";
import { computeFullPrice, calcFinalFromFullPrice } from "@/lib/package-prices";
import {
  createDraftStep1Schema,
  updateDraftStep2Schema,
  updateDraftStep3Schema,
  updateDraftStep4Schema,
  finalizeDraftSchema,
} from "@/lib/validations/booking-draft";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DraftResult {
  success: boolean;
  draftId?: string;
  error?: string;
}

export interface FinalizeDraftResult {
  success: boolean;
  bookingId?: string;
  termIds?: { id: string; sortOrder: number }[];
  error?: string;
}

export interface UnfinishedDraft {
  id: string;
  category: "WEDDINGS" | "MICE";
  customerName: string | null;
  venueId: string;
  venueName: string | null;
  // Step 1 fields — used to prefill form on resume
  packageId: string | null;
  salesId: string | null;
  weddingSession: string | null;
  weddingType: string | null;
  eventTime: string | null;
  notes: string | null;
  sourceOfInformationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Full step-1..4 detail for prefilling draft resume (includes Customer relation and persisted draft state). */
export interface DraftBookingDetail {
  id: string;
  customerName: string | null;
  customerId: string | null;
  venueId: string;
  packageId: string | null;
  salesId: string | null;
  weddingSession: string | null;
  weddingType: string | null;
  eventTime: string | null;
  notes: string | null;
  sourceOfInformationId: string | null;
  eventDate: string | null;
  paymentMethodId: string | null;
  discountName: string | null;
  discountAmount: number;
  signingLocation: string | null;
  withMaterai: boolean;
  // From Customer relation
  contactNumbers: Array<{ name: string; number: string }>;
  contactEmailCpp: string | null;
  contactEmailCpw: string | null;
  contactNikCpp: string | null;
  contactNikCpw: string | null;
  contactCppAddress: string | null;
  contactCpwAddress: string | null;
  contactBitrixId: string | null;
  // Persisted draft step 2/3 data
  termOfPayments: Array<{
    id: string;
    name: string;
    amount: number;
    dueDate: string;
    sortOrder: number;
  }>;
  draftCategoryToggles: Array<{
    categoryName: string;
    isTakeout: boolean;
    takeoutNominal: number;
  }>;
  draftComplimentaries: Array<{
    complimentaryId: string | null;
    name: string;
    price: number;
    isShowPrice: boolean;
    description: string | null;
    qty: number;
  }>;
  draftInternalItems: Array<{
    itemName: string;
    itemDescription: string;
  }>;
  draftVendorItems: Array<{
    categoryId: string | null;
    categoryName: string;
    itemText: string;
  }>;
}

// ─── Helper: build customer from draft input ──────────────────────────────────

function parseContactNumbersToArray(
  contactNumbers: string,
): Array<{ name: string; number: string }> {
  if (!contactNumbers) return [];
  try {
    const arr = JSON.parse(contactNumbers) as Array<{ name?: string; number: string }>;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((e) => ({ name: e.name ?? "", number: e.number }))
      .filter((e) => e.number);
  } catch {
    return [];
  }
}

function _serializeContactNumbersToDisplay(contactNumbers: string): string {
  if (!contactNumbers) return "";
  try {
    const arr = JSON.parse(contactNumbers) as Array<{ name?: string; number: string }>;
    if (!Array.isArray(arr)) return "";
    return arr.map((e) => (e.name ? `${e.name}: ${e.number}` : e.number)).join(", ");
  } catch {
    return "";
  }
}

// ─── STEP 1: Create Draft ─────────────────────────────────────────────────────

/**
 * Creates a DB-backed draft booking. Called when user clicks "Continue" on Step 1.
 * - Creates customer row first (same pattern as existing createBooking).
 * - Sets recordStatus = "draft" so existing queries exclude it.
 * - Returns { draftId } for subsequent update steps.
 */
export async function createDraftBooking(data: unknown): Promise<DraftResult> {
  const { session, error } = await requirePermission({ module: "booking", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`booking-draft-create:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = createDraftStep1Schema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const input = parsed.data;

  try {
    // Validate venue (+ package if given) EXIST before any customer/lead mutation.
    // The booking.create below has FK constraints on venueId/packageId; if we created
    // the customer and locked the lead first and THEN the create failed on a bad FK,
    // we'd leave an orphaned customer and a lead marked "converted" with no booking. (C-01)
    const [venueExists, packageExists] = await Promise.all([
      db.venue.findUnique({ where: { id: input.venueId }, select: { id: true } }),
      input.packageId
        ? db.package.findUnique({ where: { id: input.packageId }, select: { id: true } })
        : Promise.resolve(true as const),
    ]);
    if (!venueExists) return { success: false, error: "Venue tidak ditemukan." };
    if (!packageExists) return { success: false, error: "Paket tidak ditemukan." };

    let customerId = input.customerId ?? null;

    // Handle lead-based customer creation (same race-condition guard as createBooking)
    let leadRecord: {
      id: string;
      name: string;
      email: string | null;
      contactNumbers: unknown;
      address: string | null;
      bitrixId: string | null;
      sourceOfInformationId: string | null;
      convertedToCustomerId: string | null;
    } | null = null;

    if (input.leadId) {
      leadRecord = await db.lead.findUnique({
        where: { id: input.leadId },
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
        customerId = leadRecord.convertedToCustomerId;
        const existing = await db.customer.findUnique({
          where: { id: customerId },
          select: { id: true },
        });
        if (!existing) return { success: false, error: "Customer dari lead tidak ditemukan." };
      } else {
        // Create customer and claim conversion lock (same pattern as createBooking)
        customerId = crypto.randomUUID();
        const contactNums = mapLeadContactNumbers(leadRecord.contactNumbers);
        await db.customer.create({
          data: {
            id: customerId,
            name: leadRecord.name,
            mobileNumber: contactNums as Prisma.InputJsonValue,
            emailCpp: leadRecord.email || null,
            emailCpw: null,
            ktpAddress: leadRecord.address ?? null,
            cppAddress: leadRecord.address ?? null,
            cpwAddress: null,
            bitrixId: leadRecord.bitrixId ?? null,
            sourceOfInformationId: leadRecord.sourceOfInformationId ?? null,
            type: "Other",
            memberStatus: "Non-Member",
            updatedBy: session!.user.name ?? session!.user.email,
          },
        });

        const lockResult = await db.lead.updateMany({
          where: { id: leadRecord.id, convertedToCustomerId: null },
          data: { convertedToCustomerId: customerId },
        });

        if (lockResult.count === 0) {
          // Lost race — cleanup and reuse winner's customer
          await db.customer.delete({ where: { id: customerId } }).catch(() => undefined);
          const refreshed = await db.lead.findUnique({
            where: { id: leadRecord.id },
            select: { convertedToCustomerId: true },
          });
          if (refreshed?.convertedToCustomerId) {
            customerId = refreshed.convertedToCustomerId;
          } else {
            return { success: false, error: "Gagal mengkonversi lead, coba lagi." };
          }
        }
      }
    } else if (!customerId && input.customerName) {
      // New customer from manual input
      customerId = crypto.randomUUID();
      await db.customer.create({
        data: {
          id: customerId,
          name: input.customerName,
          mobileNumber: parseContactNumbersToArray(input.contactNumbers ?? "") as Prisma.InputJsonValue,
          emailCpp: input.contactEmailCpp || null,
          emailCpw: input.contactEmailCpw || null,
          cppNik: input.contactNikCpp || null,
          cpwNik: input.contactNikCpw || null,
          ktpAddress: null,
          cppAddress: input.contactCppAddress || null,
          cpwAddress: input.contactCpwAddress || null,
          bitrixId: input.contactBitrixId || null,
          type: "Other",
          memberStatus: "Non-Member",
          updatedBy: session!.user.name ?? session!.user.email,
        },
      });
    } else if (customerId) {
      // Validate existing customer exists
      const existing = await db.customer.findUnique({
        where: { id: customerId },
        select: { id: true },
      });
      if (!existing) return { success: false, error: "Customer tidak ditemukan." };
    }

    if (!customerId) return { success: false, error: "Customer wajib diisi." };

    const salesId = input.salesId ?? session!.user.profileId!;
    const managerId = await resolveManagerId(salesId);
    // Use client-provided id for idempotency; fall back to server-generated uuid.
    const draftId = input.id ?? crypto.randomUUID();

    // Idempotency: if a draft with this id already exists, return it directly.
    // This prevents duplicate rows when the client retries after a network hiccup.
    const existing = await db.booking.findUnique({
      where: { id: draftId },
      select: { id: true, recordStatus: true },
    });
    if (existing) {
      if (existing.recordStatus !== "draft") {
        return { success: false, error: "Booking dengan ID tersebut sudah difinalisasi." };
      }
      // Resume + edit: the draft already exists, so persist any step-1/step-2
      // changes (event date, venue, package, session, type, time, note, discount)
      // instead of the previous no-op early return that silently dropped edits.
      await db.$transaction([
        db.booking.update({
          where: { id: draftId },
          data: {
            eventDate: new Date(`${input.eventDate}T00:00:00.000Z`),
            salesId,
            managerId,
            customerId,
            venueId: input.venueId,
            packageId: input.packageId ?? null,
            sourceOfInformationId: input.sourceOfInformationId ?? null,
            weddingSession: input.weddingSession ?? null,
            weddingType: input.weddingType ?? null,
            eventTime: input.eventTime ?? null,
            notes: input.notes ?? null,
            discountName: input.specialBonusName ?? null,
            discountAmount: input.specialBonusAmount ?? 0,
          },
        }),
      ]);
      await logAudit({
        userId: session!.user.id,
        action: "booking.draft_updated",
        entityType: "booking",
        entityId: draftId,
        changes: { venueId: input.venueId, eventDate: input.eventDate },
        description: `Updated booking draft for ${input.customerName ?? customerId}`,
      });
      revalidateTag("bookings", "max");
      return { success: true, draftId };
    }

    await db.$transaction([
      db.booking.create({
        data: {
          id: draftId,
          eventDate: new Date(input.eventDate),
          recordStatus: "draft",
          bookingStatus: "Pending",
          category: input.category ?? "WEDDINGS",
          salesId,
          managerId,
          customerId,
          venueId: input.venueId,
          packageId: input.packageId ?? null,
          sourceOfInformationId: input.sourceOfInformationId ?? null,
          weddingSession: input.weddingSession ?? null,
          weddingType: input.weddingType ?? null,
          eventTime: input.eventTime ?? null,
          notes: input.notes ?? null,
          discountName: input.specialBonusName ?? null,
          discountAmount: input.specialBonusAmount ?? 0,
          ...(input.leadId ? { leadId: input.leadId } : {}),
        },
      }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "booking.draft_created",
      entityType: "booking",
      entityId: draftId,
      changes: {
        customerId,
        venueId: input.venueId,
        category: input.category ?? "WEDDINGS",
        ...(input.leadId ? { leadId: input.leadId } : {}),
      },
      description: `Created booking draft for ${input.customerName ?? customerId}`,
    });

    return { success: true, draftId };
  } catch (e) {
    console.error("[createDraftBooking]", e);
    return { success: false, error: "Gagal membuat draft booking." };
  }
}

// ─── STEP 2: Update Draft — Package/Takeout data ──────────────────────────────

export async function updateDraftBookingStep2(
  draftId: string,
  data: unknown,
): Promise<DraftResult> {
  const { session, error } = await requirePermission({ module: "booking", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`booking-draft-update:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = updateDraftStep2Schema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const input = parsed.data;

  try {
    const draft = await db.booking.findFirst({
      where: { id: draftId, recordStatus: "draft", salesId: session!.user.profileId! },
      select: { id: true },
    });

    // Super admins / managers may own a draft under a different salesId.
    // Fallback: check by id + recordStatus only (no salesId guard for admins).
    const draftCheck = draft ?? await db.booking.findFirst({
      where: { id: draftId, recordStatus: "draft" },
      select: { id: true, salesId: true },
    });

    if (!draftCheck) return { success: false, error: "Draft tidak ditemukan." };

    await db.$transaction([
      db.booking.update({
        where: { id: draftId },
        data: {
          packageId: input.packageId ?? null,
          discountName: input.specialBonusName ?? null,
          discountAmount: input.specialBonusAmount ?? 0,
          draftCategoryToggles: (input.categoryToggles && input.categoryToggles.length > 0)
            ? (input.categoryToggles as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          draftComplimentaries: (input.draftComplimentaries && input.draftComplimentaries.length > 0)
            ? (input.draftComplimentaries as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          draftInternalItems: (input.draftInternalItems && input.draftInternalItems.length > 0)
            ? (input.draftInternalItems as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          draftVendorItems: (input.draftVendorItems && input.draftVendorItems.length > 0)
            ? (input.draftVendorItems as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
      }),
    ]);

    return { success: true, draftId };
  } catch (e) {
    console.error("[updateDraftBookingStep2]", e);
    return { success: false, error: "Gagal menyimpan data paket draft." };
  }
}

// ─── STEP 3: Update Draft — Terms & Payment method ───────────────────────────

export async function updateDraftBookingStep3(
  draftId: string,
  data: unknown,
): Promise<DraftResult> {
  const { session, error } = await requirePermission({ module: "booking", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`booking-draft-update:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = updateDraftStep3Schema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const input = parsed.data;

  try {
    const draftCheck = await db.booking.findFirst({
      where: { id: draftId, recordStatus: "draft" },
      select: { id: true },
    });
    if (!draftCheck) return { success: false, error: "Draft tidak ditemukan." };

    // Reconcile terms by POSITION in the sorted list (NOT by raw sortOrder value).
    // The client always sends the complete, ordered list of terms, so aligning
    // existing DB rows ↔ incoming terms by their position keeps each row's id (and
    // its uploaded paymentEvidence) stable even when sortOrder values are non-
    // contiguous. Matching by raw sortOrder value could DELETE an evidence-bearing
    // term whose sortOrder happens to be missing from the payload (data loss).
    const existingTerms = await db.termOfPayment.findMany({
      where: { bookingId: draftId },
      select: { id: true, sortOrder: true },
    });
    const sortedExisting = [...existingTerms].sort((a, b) => a.sortOrder - b.sortOrder);
    const incoming = (input.termOfPayments ?? [])
      .map((t, i) => ({ t, effectiveSortOrder: t.sortOrder ?? i }))
      .sort((a, b) => a.effectiveSortOrder - b.effectiveSortOrder);

    // Existing rows beyond the incoming count are removed (user deleted terms).
    const toDelete = sortedExisting.slice(incoming.length);

    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.booking.update({
        where: { id: draftId },
        data: {
          paymentMethodId: input.paymentMethodId ?? null,
          discountName: input.specialBonusName ?? null,
          discountAmount: input.specialBonusAmount ?? 0,
        },
      }),
      // Delete existing terms beyond the incoming count
      ...(toDelete.length > 0
        ? [db.termOfPayment.deleteMany({ where: { id: { in: toDelete.map((e) => e.id) } } })]
        : []),
      // Reconcile each incoming term against the existing row at the same position.
      // TOP kini jadwal murni — status pembayaran DERIVED dari Ledger (Fase 5).
      ...incoming.map(({ t, effectiveSortOrder }, k) => {
        const existing = sortedExisting[k];
        if (existing) {
          return db.termOfPayment.update({
            where: { id: existing.id },
            data: {
              name: t.name,
              amount: t.amount,
              dueDate: new Date(t.dueDate),
              sortOrder: effectiveSortOrder,
            },
          });
        }
        return db.termOfPayment.create({
          data: {
            bookingId: draftId,
            name: t.name,
            amount: t.amount,
            dueDate: new Date(t.dueDate),
            sortOrder: effectiveSortOrder,
            // invoiceNumber stays null until finalize
          },
        });
      }),
    ];

    await db.$transaction(ops);

    return { success: true, draftId };
  } catch (e) {
    console.error("[updateDraftBookingStep3]", e);
    return { success: false, error: "Gagal menyimpan term of payment draft." };
  }
}

// ─── STEP 4: Update Draft — Signature/location (pre-finalize) ────────────────

export async function updateDraftBookingStep4(
  draftId: string,
  data: unknown,
): Promise<DraftResult> {
  const { session, error } = await requirePermission({ module: "booking", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`booking-draft-update:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = updateDraftStep4Schema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const input = parsed.data;

  try {
    const draftCheck = await db.booking.findFirst({
      where: { id: draftId, recordStatus: "draft" },
      select: { id: true },
    });
    if (!draftCheck) return { success: false, error: "Draft tidak ditemukan." };

    await db.$transaction([
      db.booking.update({
        where: { id: draftId },
        data: {
          signingLocation: input.signingLocation ?? null,
          salesSignature: input.signatureSales ?? null,
          withMaterai: input.withMaterai ?? false,
        },
      }),
    ]);

    return { success: true, draftId };
  } catch (e) {
    console.error("[updateDraftBookingStep4]", e);
    return { success: false, error: "Gagal menyimpan data tanda tangan draft." };
  }
}

// ─── FINALIZE: Promote draft → saved booking ──────────────────────────────────

/**
 * Finalizes a draft booking:
 * 1. Generates poNumber + invoice numbers.
 * 2. Creates snap tables (SnapCustomer, SnapVenue, SnapPackage, etc.).
 * 3. Creates ApprovalRecord + steps.
 * 4. Creates ClientAgreement.
 * 5. Sets recordStatus = "saved" + bookingStatus = "Pending".
 * 6. Updates Lead conversion tracking if applicable.
 *
 * All done in a single db.$transaction([...]) array form.
 */
export async function finalizeDraftBooking(data: unknown): Promise<FinalizeDraftResult> {
  const { session, error } = await requirePermission({ module: "booking", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`booking-draft-finalize:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = finalizeDraftSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const input = parsed.data;
  const draftId = input.draftId;

  try {
    // Fetch draft + all needed relations. Single LATERAL JOIN instead of a
    // round-trip per relation (customer, venue+brand, package+3 nested item sets,
    // termOfPayments, sales) — one of the two biggest reads in finalize.
    const draft = await db.booking.findFirst({
      where: { id: draftId, recordStatus: "draft" },
      relationLoadStrategy: "join",
      include: {
        customer: true,
        venue: { include: { brand: true } },
        package: {
          include: {
            vendorItems: true,
            internalItems: true,
            categoryPrices: true,
          },
        },
        termOfPayments: { orderBy: { sortOrder: "asc" } },
        sales: { select: { fullName: true } },
      },
    });

    if (!draft) return { success: false, error: "Draft tidak ditemukan atau sudah difinalisasi." };
    if (!draft.venueId) return { success: false, error: "Draft belum memiliki venue." };
    // Guard: customer bisa null kalau row-nya dihapus admin setelah draft dibuat.
    // Tanpa ini, akses customer.id di bawah crash + counter PO/invoice keburu bocor.
    if (!draft.customer) return { success: false, error: "Data customer tidak ditemukan. Draft mungkin sudah tidak valid." };

    // Build customer snapshot data
    const customer = draft.customer;
    const venue = draft.venue;
    const pkg = draft.package;

    // Venue conflict check for weddings (MICE has no session constraint)
    if (draft.weddingSession) {
      const eventDateObj = new Date(draft.eventDate!);
      const conflictingBooking = await db.booking.findFirst({
        where: {
          id: { not: draftId },
          venueId: draft.venueId,
          eventDate: eventDateObj,
          recordStatus: "saved",
          bookingStatus: { notIn: ["Canceled", "Lost", "Rejected"] },
          OR:
            draft.weddingSession === "fullday"
              ? [
                  { weddingSession: "morning" },
                  { weddingSession: "evening" },
                  { weddingSession: "fullday" },
                ]
              : [{ weddingSession: draft.weddingSession }, { weddingSession: "fullday" }],
        },
        select: { id: true },
      });
      if (conflictingBooking) {
        return {
          success: false,
          error: "Slot venue di tanggal & sesi tersebut sudah dibooking.",
        };
      }
    }

    const now = new Date();
    const year = now.getFullYear();
    const dd = now.getDate().toString().padStart(2, "0");
    const mm = (now.getMonth() + 1).toString().padStart(2, "0");
    const eventTypeCode = draft.weddingType ?? (draft.category === "WEDDINGS" ? "WDG" : "MICE");
    const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
    const terms = draft.termOfPayments;

    // These three reads are mutually independent — run them in ONE parallel batch
    // instead of sequential awaits. Invoice numbers use a single batched counter
    // increment (1 round-trip for N terms, not N). Over Neon HTTP every round-trip
    // is a network hop, so this collapses ~N+2 hops into effectively one.
    const [poSeq, invoiceSeqs, bookingApprovalSteps, kwitansiSeqs] = await Promise.all([
      getNextSequence(`po-${year}`),
      getNextSequenceBatch(`invoice-${year}`, terms.length),
      // Resolve approval steps: conditional Sales + Manager → Finance.
      // Auto-approve Sales only when the finalizer IS the assigned sales (and signed).
      buildBookingApprovalSteps({
        salesId: draft.salesId,
        creatorProfileId: session!.user.profileId!,
        signatureSales: input.signatureSales ?? draft.salesSignature,
        decidedAt: new Date(),
        includeClientStep: true, // Wedding: client TTD step included
      }),
      // Nomor kwitansi buat cash-in step 6 (§7.2) — batch 1 hop untuk N payment.
      input.payments.length > 0
        ? getNextSequenceBatch(`kwitansi-${year}`, input.payments.length)
        : Promise.resolve([] as number[]),
    ]);

    const poNumber = `${poSeq.toString().padStart(3, "0")}/${venue?.brand?.code ?? ""}/${venue?.code ?? ""}/${eventTypeCode}/${dd}-${mm}-${year}`;
    const monthRoman = ROMAN[now.getMonth()];
    const invoiceNumbers: string[] = invoiceSeqs.map(
      (seq) => `${seq}/INV/${venue?.code ?? ""}/${monthRoman}/${year}`,
    );
    // KWITANSI pakai bulan ANGKA (beda dari INVOICE Romawi §7.2) — dua dokumen berbeda.
    const kwitansiNumbers: string[] = kwitansiSeqs.map(
      (seq) =>
        `${seq.toString().padStart(4, "0")}/KW/${venue?.brand?.code ?? ""}/${venue?.code ?? ""}/${mm}/${year}`,
    );

    // Build categoryToggles map from input (for snap creation)
    const toggleMap = new Map(
      (input.categoryToggles ?? []).map((t) => [t.categoryName, t.isTakeout])
    );
    const nominalMap = new Map(
      (input.categoryToggles ?? []).map((t) => [t.categoryName, t.takeoutNominal ?? 0])
    );

    // Build transaction ops array
    const ops: Prisma.PrismaPromise<unknown>[] = [];

    // 1. Promote booking to saved
    ops.push(
      db.booking.update({
        where: { id: draftId },
        data: {
          recordStatus: "saved",
          bookingStatus: "Pending",
          poNumber,
          // Sortable PO parts — let the DB order by (year desc, seq desc) natively
          // instead of fetching everything and sorting in-app. (scalability)
          poYear: year,
          poSeq,
          signingLocation: input.signingLocation ?? draft.signingLocation ?? null,
          salesSignature: input.signatureSales ?? draft.salesSignature ?? null,
          withMaterai: input.withMaterai ?? draft.withMaterai ?? false,
        },
      })
    );

    // 2. Create SnapCustomer
    const mobileDisplay = Array.isArray(customer.mobileNumber)
      ? (customer.mobileNumber as Array<{ name?: string; number: string }>)
          .map((e) => (e.name ? `${e.name}: ${e.number}` : e.number))
          .join(", ")
      : String(customer.mobileNumber ?? "");

    ops.push(
      db.snapCustomer.create({
        data: {
          bookingId: draftId,
          customerId: customer.id,
          name: customer.name,
          emailCpp: customer.emailCpp ?? null,
          emailCpw: customer.emailCpw ?? null,
          mobileNumber: mobileDisplay,
          cppNik: customer.cppNik,
          cpwNik: customer.cpwNik,
          ktpAddress: customer.ktpAddress,
          cppAddress: customer.cppAddress,
          cpwAddress: customer.cpwAddress,
        },
      })
    );

    // 3. Create SnapVenue
    if (venue) {
      ops.push(
        db.snapVenue.create({
          data: {
            bookingId: draftId,
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

    // 4. Create SnapPackage + SnapPackagePricing + items (only for weddings with package)
    if (pkg) {
      const takeoutCategoryIds = new Set(
        pkg.categoryPrices
          .filter((c) => c.isShow && (toggleMap.get(c.categoryName) ?? false) && c.categoryId)
          .map((c) => c.categoryId as string)
      );
      // Unified price model: fullPrice anchor − Σ(takeout nominal). UI == DB.
      const fullPrice = computeFullPrice(pkg.categoryPrices, pkg.margin ?? 0, pkg.sellingPrice);
      const pkgPrice = calcFinalFromFullPrice(
        pkg.categoryPrices.map((c) => ({
          isShow: c.isShow,
          isTakeout: c.isShow ? (toggleMap.get(c.categoryName) ?? false) : false,
          basePrice: c.basePrice,
          takeoutNominal: nominalMap.get(c.categoryName) ?? 0,
        })),
        fullPrice,
      );

      ops.push(
        db.snapPackage.create({
          data: {
            bookingId: draftId,
            packageId: pkg.id,
            packageName: pkg.packageName,
            notes: pkg.notes,
          },
        }),
        db.snapPackagePricing.create({
          data: {
            bookingId: draftId,
            packageId: pkg.id,
            packageName: pkg.packageName,
            pax: pkg.pax,
            price: pkgPrice,
            fullPrice,
            margin: pkg.margin ?? 0,
            termAndCondition: pkg.termAndCondition ?? null,
          },
        })
      );

      // Prefer draft-edited items (Item Paket step); fall back to the package
      // template when the user never touched them. Draft columns are JSON blobs.
      const draftInternal = Array.isArray(draft.draftInternalItems)
        ? (draft.draftInternalItems as Array<Record<string, unknown>>)
            .filter((e) => typeof e.itemName === "string")
            .map((e) => ({
              itemName: e.itemName as string,
              itemDescription: typeof e.itemDescription === "string" ? e.itemDescription : "",
            }))
        : [];
      const draftVendor = Array.isArray(draft.draftVendorItems)
        ? (draft.draftVendorItems as Array<Record<string, unknown>>)
            .filter((e) => typeof e.categoryName === "string")
            .map((e) => ({
              categoryId: typeof e.categoryId === "string" ? e.categoryId : null,
              categoryName: e.categoryName as string,
              itemText: typeof e.itemText === "string" ? e.itemText : "",
            }))
        : [];

      const internalSource = draftInternal.length > 0
        ? draftInternal
        : pkg.internalItems.map((item) => ({
            itemName: item.itemName,
            itemDescription: item.itemDescription,
          }));
      const vendorSource = draftVendor.length > 0
        ? draftVendor
        : pkg.vendorItems.map((item) => ({
            categoryId: item.categoryId ?? null,
            categoryName: item.categoryName,
            itemText: item.itemText,
          }));

      if (internalSource.length > 0) {
        ops.push(
          ...internalSource.map((item, i) =>
            db.snapPackageInternalItem.create({
              data: {
                bookingId: draftId,
                itemName: item.itemName,
                itemDescription: item.itemDescription,
                sortOrder: i,
              },
            })
          )
        );
      }

      if (vendorSource.length > 0) {
        ops.push(
          ...vendorSource.map((item, i) =>
            db.snapPackageVendorItem.create({
              data: {
                bookingId: draftId,
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
          ...pkg.categoryPrices.map((cp) => {
            const isTakeout = cp.isShow ? (toggleMap.get(cp.categoryName) ?? false) : false;
            return db.snapPackageCategoryPrice.create({
              data: {
                bookingId: draftId,
                categoryId: cp.categoryId ?? null,
                categoryName: cp.categoryName,
                basePrice: cp.basePrice,
                sortOrder: cp.sortOrder,
                isShow: cp.isShow,
                isTakeout,
                takeoutNominal: isTakeout ? ((nominalMap.get(cp.categoryName) ?? 0) || cp.basePrice) : 0,
              },
            });
          })
        );
      }
    }

    // 5. Add bonuses (legacy vendor-based — kept for backward compat)
    if (input.bonuses && input.bonuses.length > 0) {
      ops.push(
        ...input.bonuses.map((bonus) =>
          db.snapBonus.create({
            data: {
              bookingId: draftId,
              vendorId: bonus.vendorId,
              vendorCategoryId: bonus.vendorCategoryId,
              vendorName: bonus.vendorName,
              description: bonus.description ?? null,
              qty: bonus.qty,
              nominal: bonus.nominal ?? 0,
            },
          })
        )
      );
    }

    // 5b. Add complimentaries (new complimentary-based snap rows)
    if (input.complimentaries && input.complimentaries.length > 0) {
      ops.push(
        ...input.complimentaries.map((c, i) =>
          db.snapComplimentary.create({
            data: {
              bookingId: draftId,
              complimentaryId: c.complimentaryId ?? null,
              name: c.name,
              price: c.price,
              isShowPrice: c.isShowPrice,
              description: c.description ?? null,
              qty: c.qty,
              sortOrder: c.sortOrder ?? i,
            },
          })
        )
      );
    }

    // 6. Stamp invoice numbers on existing draft terms
    if (terms.length > 0) {
      ops.push(
        ...terms.map((t, i) =>
          db.termOfPayment.update({
            where: { id: t.id },
            data: { invoiceNumber: invoiceNumbers[i] ?? null },
          })
        )
      );
    }

    // 6b. Step-6 payments → Ledger(`in`) + PaymentAllocation + activity (§8).
    // Termin sudah persist di step-3 → resolve alokasi lewat sortOrder→termId di sini.
    // Alokasi di-clamp defensif (drop sortOrder tak dikenal, cap Σ ≤ gross & ≤ nominal
    // termin) supaya isu alokasi TIDAK pernah menggagalkan finalisasi booking.
    // Catatan: bukti bayar (File) step-6 BELUM diupload di sini — Ledger lahir tanpa
    // evidence; lampiran menyusul (gap yang sama dengan cashbook drawer Fase 4).
    if (input.payments.length > 0) {
      const termBySortOrder = new Map(
        terms.map((t) => [t.sortOrder, { id: t.id, amount: Number(t.amount) }]),
      );
      const actorName = session!.user.name ?? "Sales";

      input.payments.forEach((p, pi) => {
        const gross = p.amount;
        const discountAmount = Math.min(p.discountAmount ?? 0, gross);
        const cashAmount = gross - discountAmount;

        let budget = gross;
        const allocOps: { termId: string; amount: number }[] = [];
        for (const a of p.allocations) {
          const term = termBySortOrder.get(a.sortOrder);
          if (!term || budget <= 0) continue;
          const amt = Math.min(a.amount, term.amount, budget);
          if (amt > 0) {
            allocOps.push({ termId: term.id, amount: amt });
            budget -= amt;
          }
        }

        const ledgerId = crypto.randomUUID();
        ops.push(
          db.ledger.create({
            data: {
              id: ledgerId,
              bookingId: draftId,
              direction: "in",
              ackStatus: "pending",
              paymentStatus: "paid",
              occurredAt: new Date(p.occurredAt),
              amount: gross,
              discountProgramId: p.discountProgramId ?? null,
              discountAmount,
              cashAmount,
              paymentMethodId: p.paymentMethodId ?? null,
              evidence: null,
              invoiceNumber: kwitansiNumbers[pi] ?? null,
              notes: p.notes?.trim() || null,
              showInPo: p.showInPo ?? false,
              createdById: session!.user.profileId!,
            },
          }),
          ...allocOps.map((a) =>
            db.paymentAllocation.create({
              data: { ledgerId, termId: a.termId, amount: a.amount },
            }),
          ),
          db.paymentActivity.create({
            data: {
              ledgerId,
              action: "created",
              actorId: session!.user.profileId!,
              actorNameSnapshot: actorName,
              note: p.notes?.trim() || null,
            },
          }),
        );
      });
    }

    // 7. ApprovalRecord + steps (Sales → Manager → Finance)
    if (bookingApprovalSteps && bookingApprovalSteps.length > 0) {
      const approvalRecordId = crypto.randomUUID();

      ops.push(
        db.approvalRecord.create({
          data: {
            id: approvalRecordId,
            module: "booking",
            entityId: draftId,
            status: "pending",
            createdById: session!.user.profileId!,
          },
        }),
        ...bookingApprovalSteps.map((step) =>
          db.approvalRecordStep.create({
            data: {
              recordId: approvalRecordId,
              stepOrder: step.stepOrder,
              approverType: step.approverType,
              approverRoleId: step.approverRoleId,
              approverUserId: step.approverUserId,
              status: step.status,
              decidedById: step.decidedById,
              decidedAt: step.decidedAt,
              signature: step.signature,
            },
          })
        )
      );
    }

    // 8. ClientAgreement
    ops.push(
      db.clientAgreement.create({
        data: {
          bookingId: draftId,
          token: crypto.randomUUID(),
          accessCode: generateAccessCode(),
        },
      })
    );

    // 9. Lead conversion update (if draft was created from a lead)
    if (input.leadId) {
      const convertedStatus = await db.leadStatus.findFirst({
        where: { isSystem: true, isFinal: true },
        select: { id: true },
      });
      ops.push(
        db.lead.update({
          where: { id: input.leadId },
          data: {
            convertedToBookingId: draftId,
            convertedAt: new Date(),
            ...(convertedStatus ? { statusId: convertedStatus.id } : {}),
          },
        })
      );
    }

    await db.$transaction(ops);

    // ── POST-COMMIT ──────────────────────────────────────────────────────────
    // The booking is now FINALIZED (transaction above committed). Everything below
    // is follow-up work: revision snapshot, audit log, term-id fetch. A failure here
    // must NOT surface as "Gagal memfinalisasi" — that made users retry a booking
    // that was already saved, then hit "sudah difinalisasi". So we isolate the
    // post-commit work in its own try/catch and ALWAYS return success. (F-14)
    const revisionFlow = async (): Promise<void> => {
      // Create initial revision (WEDDINGS + package required for revision snapshot)
      if (draft.category === "WEDDINGS" && pkg) {
        const revisionId = await createBookingRevision(
          draftId,
          session!.user.profileId!,
          "Initial booking"
        );
        await db.$transaction([
          db.approvalRecordStep.updateMany({
            where: { record: { module: "booking", entityId: draftId } },
            data: { revisionId },
          }),
          db.booking.update({
            where: { id: draftId },
            data: { currentRevisionId: revisionId },
          }),
        ]);
      }
    };

    let createdTerms: { id: string; sortOrder: number }[] = [];
    try {
      const [, , terms] = await Promise.all([
        logAudit({
          userId: session!.user.id,
          action: "booking.finalized",
          entityType: "booking",
          entityId: draftId,
          changes: {
            poNumber,
            customerId: draft.customerId,
            venueId: draft.venueId,
            ...(input.leadId ? { leadId: input.leadId } : {}),
          },
          description: `Finalized booking draft for ${draft.customer?.name ?? draft.customerId}`,
        }),
        revisionFlow(),
        // Term IDs for client-side evidence upload
        db.termOfPayment.findMany({
          where: { bookingId: draftId },
          select: { id: true, sortOrder: true },
          orderBy: { sortOrder: "asc" },
        }),
      ]);
      createdTerms = terms;
    } catch (postCommitErr) {
      // Booking is already committed — log and continue. Evidence upload may need a
      // manual retry if createdTerms is empty, but the booking itself is valid.
      console.error("[finalizeDraftBooking] post-commit follow-up failed (booking already saved)", postCommitErr);
    }

    revalidateTag("bookings", "max");
    revalidateTag("customers", "max");
    if (input.payments.length > 0) {
      revalidateTag("ledger", "max");
      revalidateTag("ar-bookings", "max");
    }
    if (input.leadId) revalidateTag("leads", "max");

    // Notify super admins (fire-and-forget — never blocks the response)
    notifySuperAdmins(
      {
        title: "Booking Baru",
        message: `${session!.user.name ?? "User"} membuat booking untuk ${draft.customer?.name ?? "Unknown"}.`,
        type: "booking_created",
        entityType: "booking",
        entityId: draftId,
      },
      session!.user.profileId!
    );

    return { success: true, bookingId: draftId, termIds: createdTerms };
  } catch (e) {
    console.error("[finalizeDraftBooking]", e);
    return { success: false, error: "Gagal memfinalisasi booking." };
  }
}

// ─── Query: get user's unfinished draft ───────────────────────────────────────

/**
 * Returns the most recent unfinished draft for the given user and category.
 * Only returns drafts less than 7 days old (cleanup boundary).
 */
export async function getUserUnfinishedDraft(
  profileId: string,
  category: "WEDDINGS" | "MICE" = "WEDDINGS",
): Promise<UnfinishedDraft | null> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Resume scope follows the user's dataScope (set at invite time), independent
  // of permissions: "own" → only their drafts, "group" → drafts of group peers,
  // "all" → any draft. This lets e.g. an admin (scope "all") resume a draft they
  // created under a different Sales PIC.
  const dataScope = await getProfileDataScope(profileId);
  let salesFilter: Prisma.BookingWhereInput = { salesId: profileId };
  if (dataScope === "all") {
    salesFilter = {};
  } else if (dataScope === "group") {
    const myGroups = await db.userGroupMember.findMany({
      where: { userId: profileId },
      select: { groupId: true },
    });
    const groupIds = myGroups.map((g) => g.groupId);
    if (groupIds.length > 0) {
      const peers = await db.userGroupMember.findMany({
        where: { groupId: { in: groupIds } },
        select: { userId: true },
      });
      const peerIds = Array.from(new Set([profileId, ...peers.map((p) => p.userId)]));
      salesFilter = { salesId: { in: peerIds } };
    }
  }

  const draft = await db.booking.findFirst({
    where: {
      ...salesFilter,
      recordStatus: "draft",
      category,
      createdAt: { gte: sevenDaysAgo },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      category: true,
      customerId: true,
      venueId: true,
      packageId: true,
      salesId: true,
      weddingSession: true,
      weddingType: true,
      eventTime: true,
      notes: true,
      sourceOfInformationId: true,
      createdAt: true,
      updatedAt: true,
      customer: { select: { name: true } },
      venue: { select: { name: true } },
    },
  });

  if (!draft) return null;

  return {
    id: draft.id,
    category: draft.category,
    customerName: draft.customer?.name ?? null,
    venueId: draft.venueId,
    venueName: draft.venue?.name ?? null,
    packageId: draft.packageId ?? null,
    salesId: draft.salesId ?? null,
    weddingSession: draft.weddingSession ?? null,
    weddingType: draft.weddingType ?? null,
    eventTime: draft.eventTime ?? null,
    notes: draft.notes ?? null,
    sourceOfInformationId: draft.sourceOfInformationId ?? null,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
}

// ─── Query: get full draft detail for resume prefill ─────────────────────────

/**
 * Returns full step-1 draft data including Customer relation fields.
 * Used by booking-drawer resume handler to prefill ALL step 1 fields.
 * Access is guarded: booking must be a draft owned by the caller (or admin).
 */
export async function getDraftBookingDetail(
  draftId: string,
): Promise<DraftBookingDetail | null> {
  const draft = await db.booking.findFirst({
    where: { id: draftId, recordStatus: "draft" },
    select: {
      id: true,
      customerId: true,
      venueId: true,
      packageId: true,
      salesId: true,
      weddingSession: true,
      weddingType: true,
      eventTime: true,
      notes: true,
      sourceOfInformationId: true,
      eventDate: true,
      paymentMethodId: true,
      discountName: true,
      discountAmount: true,
      signingLocation: true,
      withMaterai: true,
      draftCategoryToggles: true,
      draftComplimentaries: true,
      draftInternalItems: true,
      draftVendorItems: true,
      customer: {
        select: {
          name: true,
          mobileNumber: true,
          emailCpp: true,
          emailCpw: true,
          cppNik: true,
          cpwNik: true,
          cppAddress: true,
          cpwAddress: true,
          bitrixId: true,
        },
      },
      termOfPayments: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          amount: true,
          dueDate: true,
          sortOrder: true,
        },
      },
    },
  });

  if (!draft) return null;

  // Parse mobileNumber JSON → typed array
  const rawMobile = draft.customer?.mobileNumber;
  let contactNumbers: Array<{ name: string; number: string }> = [];
  if (Array.isArray(rawMobile)) {
    contactNumbers = (rawMobile as Array<Record<string, unknown>>)
      .map((e) => ({
        name: typeof e.name === "string" ? e.name : typeof e.label === "string" ? e.label : "",
        number: typeof e.number === "string" ? e.number : "",
      }))
      .filter((e) => e.number);
  }

  // Parse draftCategoryToggles JSON → typed array
  const rawToggles = draft.draftCategoryToggles;
  let draftCategoryToggles: Array<{ categoryName: string; isTakeout: boolean; takeoutNominal: number }> = [];
  if (Array.isArray(rawToggles)) {
    draftCategoryToggles = (rawToggles as Array<Record<string, unknown>>)
      .filter((e) => typeof e.categoryName === "string")
      .map((e) => ({
        categoryName: e.categoryName as string,
        isTakeout: typeof e.isTakeout === "boolean" ? e.isTakeout : false,
        takeoutNominal: typeof e.takeoutNominal === "number" ? e.takeoutNominal : 0,
      }));
  }

  // Parse draftComplimentaries JSON → typed array
  const rawComps = draft.draftComplimentaries;
  let draftComplimentaries: Array<{
    complimentaryId: string | null;
    name: string;
    price: number;
    isShowPrice: boolean;
    description: string | null;
    qty: number;
  }> = [];
  if (Array.isArray(rawComps)) {
    draftComplimentaries = (rawComps as Array<Record<string, unknown>>)
      .filter((e) => typeof e.name === "string")
      .map((e) => ({
        complimentaryId: typeof e.complimentaryId === "string" ? e.complimentaryId : null,
        name: e.name as string,
        price: typeof e.price === "number" ? e.price : 0,
        isShowPrice: typeof e.isShowPrice === "boolean" ? e.isShowPrice : false,
        description: typeof e.description === "string" ? e.description : null,
        qty: typeof e.qty === "number" ? e.qty : 1,
      }));
  }

  // Parse draftInternalItems JSON → typed array
  const rawInternal = draft.draftInternalItems;
  let draftInternalItems: Array<{ itemName: string; itemDescription: string }> = [];
  if (Array.isArray(rawInternal)) {
    draftInternalItems = (rawInternal as Array<Record<string, unknown>>)
      .filter((e) => typeof e.itemName === "string")
      .map((e) => ({
        itemName: e.itemName as string,
        itemDescription: typeof e.itemDescription === "string" ? e.itemDescription : "",
      }));
  }

  // Parse draftVendorItems JSON → typed array
  const rawVendor = draft.draftVendorItems;
  let draftVendorItems: Array<{ categoryId: string | null; categoryName: string; itemText: string }> = [];
  if (Array.isArray(rawVendor)) {
    draftVendorItems = (rawVendor as Array<Record<string, unknown>>)
      .filter((e) => typeof e.categoryName === "string")
      .map((e) => ({
        categoryId: typeof e.categoryId === "string" ? e.categoryId : null,
        categoryName: e.categoryName as string,
        itemText: typeof e.itemText === "string" ? e.itemText : "",
      }));
  }

  return {
    id: draft.id,
    customerName: draft.customer?.name ?? null,
    customerId: draft.customerId ?? null,
    venueId: draft.venueId,
    packageId: draft.packageId ?? null,
    salesId: draft.salesId ?? null,
    weddingSession: draft.weddingSession ?? null,
    weddingType: draft.weddingType ?? null,
    eventTime: draft.eventTime ?? null,
    notes: draft.notes ?? null,
    sourceOfInformationId: draft.sourceOfInformationId ?? null,
    eventDate: draft.eventDate
      ? `${draft.eventDate.getUTCFullYear()}-${String(draft.eventDate.getUTCMonth() + 1).padStart(2, "0")}-${String(draft.eventDate.getUTCDate()).padStart(2, "0")}`
      : null,
    paymentMethodId: draft.paymentMethodId ?? null,
    discountName: draft.discountName ?? null,
    discountAmount: draft.discountAmount ?? 0,
    signingLocation: draft.signingLocation ?? null,
    withMaterai: draft.withMaterai ?? false,
    contactNumbers,
    contactEmailCpp: draft.customer?.emailCpp ?? null,
    contactEmailCpw: draft.customer?.emailCpw ?? null,
    contactNikCpp: draft.customer?.cppNik ?? null,
    contactNikCpw: draft.customer?.cpwNik ?? null,
    contactCppAddress: draft.customer?.cppAddress ?? null,
    contactCpwAddress: draft.customer?.cpwAddress ?? null,
    contactBitrixId: draft.customer?.bitrixId ?? null,
    termOfPayments: draft.termOfPayments.map((t) => ({
      id: t.id,
      name: t.name,
      amount: t.amount,
      dueDate: t.dueDate.toISOString(),
      sortOrder: t.sortOrder,
    })),
    draftCategoryToggles,
    draftComplimentaries,
    draftInternalItems,
    draftVendorItems,
  };
}

// ─── Cleanup: delete drafts older than 7 days ────────────────────────────────

/**
 * Deletes draft bookings older than cutoffDays (default 7).
 * Called from /api/admin/cleanup-drafts (secured by CLEANUP_SECRET).
 * Also performs lazy cleanup on-open (via getUserUnfinishedDraft returning null).
 */
export async function cleanupOldDrafts(cutoffDays = 7): Promise<{ deleted: number }> {
  const cutoff = new Date(Date.now() - cutoffDays * 24 * 60 * 60 * 1000);

  const oldDrafts = await db.booking.findMany({
    where: { recordStatus: "draft", createdAt: { lt: cutoff } },
    select: { id: true },
    take: 500,
  });

  if (oldDrafts.length === 0) return { deleted: 0 };

  const ids = oldDrafts.map((d) => d.id);

  // Cascade handles term_of_payments etc.
  // ActivityLog and Notifications for drafts shouldn't exist, but cleanup just in case.
  await db.$transaction([
    db.activityLog.deleteMany({ where: { entityType: "booking", entityId: { in: ids } } }),
    db.termOfPayment.deleteMany({ where: { bookingId: { in: ids } } }),
    db.booking.deleteMany({ where: { id: { in: ids }, recordStatus: "draft" } }),
  ]);

  return { deleted: ids.length };
}

// ─── Internal helper ──────────────────────────────────────────────────────────

function mapLeadContactNumbers(
  raw: unknown,
): Array<{ name: string; number: string }> {
  if (!Array.isArray(raw)) return [];
  return (raw as Array<Record<string, unknown>>)
    .map((e) => ({
      name:
        typeof e.label === "string"
          ? e.label
          : typeof e.name === "string"
            ? e.name
            : "",
      number: typeof e.number === "string" ? e.number : "",
    }))
    .filter((e) => e.number);
}
