"use server";

import { revalidateTag } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { getNextSequence } from "@/lib/counter";
import { resolveApprovalSteps } from "@/lib/approval-flows";
import { createBookingRevision } from "@/lib/booking-revision";
import { resolveManagerId } from "@/lib/resolve-manager";
import { notifySuperAdmins } from "@/lib/notifications";
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
  createdAt: Date;
  updatedAt: Date;
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
            email: leadRecord.email || "-@placeholder.com",
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
          email: input.contactEmail || "-@placeholder.com",
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
    const draftId = crypto.randomUUID();

    await db.$transaction([
      db.booking.create({
        data: {
          id: draftId,
          bookingDate: new Date(input.bookingDate),
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
          discountName: input.specialBonusName ?? null,
          discountAmount: input.specialBonusAmount ?? 0,
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

    // Replace term of payments atomically — delete existing, insert new ones.
    // Invoice numbers are NOT generated yet (only on finalize).
    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.booking.update({
        where: { id: draftId },
        data: {
          paymentMethodId: input.paymentMethodId ?? null,
          discountName: input.specialBonusName ?? null,
          discountAmount: input.specialBonusAmount ?? 0,
        },
      }),
      db.termOfPayment.deleteMany({ where: { bookingId: draftId } }),
      ...(input.termOfPayments ?? []).map((t, i) =>
        db.termOfPayment.create({
          data: {
            bookingId: draftId,
            name: t.name,
            amount: t.amount,
            dueDate: new Date(t.dueDate),
            sortOrder: t.sortOrder ?? i,
            paymentStatus: (t.paymentStatus ?? "unpaid") as
              | "unpaid"
              | "paid"
              | "partial"
              | "refund",
            // invoiceNumber stays null until finalize
          },
        })
      ),
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
    // Fetch draft + all needed relations
    const draft = await db.booking.findFirst({
      where: { id: draftId, recordStatus: "draft" },
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

    // Build customer snapshot data
    const customer = draft.customer;
    const venue = draft.venue;
    const pkg = draft.package;

    // Venue conflict check for weddings (MICE has no session constraint)
    if (draft.weddingSession) {
      const bookingDateObj = new Date(draft.bookingDate);
      const conflictingBooking = await db.booking.findFirst({
        where: {
          id: { not: draftId },
          venueId: draft.venueId,
          bookingDate: bookingDateObj,
          recordStatus: "saved",
          bookingStatus: { notIn: ["Canceled", "Lost"] },
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

    // Generate PO Number
    const now = new Date();
    const year = now.getFullYear();
    const poSeq = await getNextSequence(`po-${year}`);
    const dd = now.getDate().toString().padStart(2, "0");
    const mm = (now.getMonth() + 1).toString().padStart(2, "0");
    const eventTypeCode = draft.weddingType ?? "MICE";
    const poNumber = `${poSeq.toString().padStart(3, "0")}/${venue?.brand?.code ?? ""}/${venue?.code ?? ""}/${eventTypeCode}/${dd}-${mm}-${year}`;

    const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

    // Generate invoice numbers for existing draft terms
    const terms = draft.termOfPayments;
    const invoiceNumbers: string[] = [];
    if (terms.length > 0) {
      const monthRoman = ROMAN[now.getMonth()];
      for (const _ of terms) {
        const seq = await getNextSequence(`invoice-${year}`);
        invoiceNumbers.push(`${seq}/INV/${venue?.code ?? ""}/${monthRoman}/${year}`);
      }
    }

    // Resolve approval steps
    const bookingApprovalSteps = await resolveApprovalSteps("booking");

    // Build categoryToggles map from input (for snap creation)
    const toggleMap = new Map(
      (input.categoryToggles ?? []).map((t) => [t.categoryName, t.isTakeout])
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
          email: customer.email,
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
      const hasTakeout = (input.categoryToggles ?? []).some((t) => t.isTakeout);
      const pkgBase = pkg.categoryPrices.reduce((sum, c) => {
        if (!c.isShow) return sum + c.basePrice;
        const isTakeout = toggleMap.get(c.categoryName) ?? false;
        return isTakeout ? sum : sum + c.basePrice;
      }, 0);
      const pkgPrice =
        !hasTakeout && pkg.sellingPrice > 0
          ? pkg.sellingPrice
          : pkgBase + Math.round(pkgBase * ((pkg.margin ?? 0) / 100));

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
            margin: pkg.margin ?? 0,
            termAndCondition: pkg.termAndCondition ?? null,
          },
        })
      );

      if (pkg.internalItems.length > 0) {
        ops.push(
          ...pkg.internalItems.map((item, i) =>
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

      if (pkg.vendorItems.length > 0) {
        ops.push(
          ...pkg.vendorItems.map((item, i) =>
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
          ...pkg.categoryPrices.map((cp) =>
            db.snapPackageCategoryPrice.create({
              data: {
                bookingId: draftId,
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

    // 5. Add bonuses
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

    // 7. ApprovalRecord + steps
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
            entityId: draftId,
            status: "pending",
            createdById: session!.user.profileId!,
          },
        }),
        ...bookingApprovalSteps.map((step, i) => {
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

    // 8. ClientAgreement
    ops.push(
      db.clientAgreement.create({
        data: {
          bookingId: draftId,
          token: crypto.randomUUID(),
          accessCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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

    await logAudit({
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
    });

    // Create initial revision
    if (draft.category === "WEDDINGS" && pkg) {
      const revisionId = await createBookingRevision(
        draftId,
        session!.user.profileId!,
        "Initial booking"
      );
      await db.approvalRecordStep.updateMany({
        where: { record: { module: "booking", entityId: draftId } },
        data: { revisionId },
      });
    }

    revalidateTag("bookings", "max");
    revalidateTag("customers", "max");
    if (input.leadId) revalidateTag("leads", "max");

    // Notify super admins
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

    // Return term IDs for client-side evidence upload
    const createdTerms = await db.termOfPayment.findMany({
      where: { bookingId: draftId },
      select: { id: true, sortOrder: true },
      orderBy: { sortOrder: "asc" },
    });

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

  const draft = await db.booking.findFirst({
    where: {
      salesId: profileId,
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
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
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
