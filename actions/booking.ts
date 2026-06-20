"use server";

import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { notifySuperAdmins } from "@/lib/notifications";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { isSlotConflictError, SLOT_TAKEN_MESSAGE } from "@/lib/booking-slot-error";
import { bookingSchema, updateBookingSchema, editBookingSchema, updateBookingClientInfoSchema } from "@/lib/validations/booking";
import { buildBookingApprovalSteps } from "@/lib/approval-flows";
import { getNextSequence } from "@/lib/counter";
import { createBookingRevision } from "@/lib/booking-revision";
import { resolveManagerId } from "@/lib/resolve-manager";
import { canAccessBooking, getProfileDataScope } from "@/lib/access-control";
import { generateEmaterai } from "@/lib/peruri";
import { computeFullPrice, calcFinalFromFullPrice } from "@/lib/package-prices";
import { deleteFromStorage } from "@/lib/storage";

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
        where: { id: leadId, deletedAt: null },
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
        // Race-condition guard (create-then-lock pattern):
        // Step 1: Create the customer row first (standalone, outside main transaction).
        //         FK constraint on leads.convertedToCustomerId requires the customer to
        //         exist before the lead row is stamped — the previous "stamp-then-create"
        //         approach caused P2003 every time.
        // Step 2: Claim the conversion lock via updateMany(WHERE convertedToCustomerId IS NULL).
        //         Only one concurrent winner (count=1); loser (count=0) cleans up the orphan
        //         customer it just created and reuses the winner's customerId.
        // Self-healing: if the main transaction fails after the customer is created and the lead
        //         is stamped, the next attempt finds convertedToCustomerId already set and falls
        //         into the "reuse existing customer" path (lines above) — no permanent deadlock.
        customerId = crypto.randomUUID();

        // Step 1: create customer row so FK is satisfiable before the stamp.
        await db.customer.create({
          data: {
            id: customerId,
            name: leadRecord.name,
            mobileNumber: mapLeadContactNumbers(leadRecord.contactNumbers) as Prisma.InputJsonValue,
            emailCpp: leadRecord.email || null,
            emailCpw: null,
            cppNik: null,
            cpwNik: null,
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

        // Step 2: claim the conversion lock — FK is now valid.
        const lockResult = await db.lead.updateMany({
          where: { id: leadRecord.id, convertedToCustomerId: null },
          data: { convertedToCustomerId: customerId },
        });

        if (lockResult.count === 0) {
          // Lost the race — a concurrent request already stamped the lead.
          // Delete the orphan customer we created, then reuse the winner's customer.
          await db.customer.delete({ where: { id: customerId } }).catch(() => {
            // Deletion is best-effort; if it fails the row stays as a harmless orphan.
          });
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
          // Won the race — customer already created standalone; do NOT create again in ops[].
          // isNewCustomer stays false so ops[] skips db.customer.create for this path.
          // didLockLeadConversion = true tells ops[] to stamp convertedAt on the lead.
          isNewCustomer = false;
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
      const eventDateObj = new Date(`${input.eventDate}T00:00:00.000Z`);
      const conflictingBooking = await db.booking.findFirst({
        where: {
          venueId: input.venueId,
          recordStatus: "saved",
          eventDate: eventDateObj,
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
            emailCpp: leadRecord.email || null,
            emailCpw: null as string | null,
            cppNik: null as string | null,
            cpwNik: null as string | null,
            ktpAddress: leadRecord.address ?? null,
            cppAddress: leadRecord.address ?? null,
            cpwAddress: null as string | null,
          }
        : {
            // Customer baru dari input manual (fallback path)
            id: customerId,
            name: input.customerName!,
            mobileNumber: parseContactNumbersToArray(input.contactNumbers ?? ""),
            emailCpp: input.contactEmailCpp || null,
            emailCpw: input.contactEmailCpw || null,
            cppNik: input.contactNikCpp || null,
            cpwNik: input.contactNikCpw || null,
            ktpAddress: null as string | null,
            cppAddress: input.contactCppAddress || null,
            cpwAddress: input.contactCpwAddress || null,
          }
      : {
          id: existingCustomer!.id,
          name: existingCustomer!.name,
          mobileNumber: existingCustomer!.mobileNumber,
          emailCpp: existingCustomer!.emailCpp,
          emailCpw: existingCustomer!.emailCpw,
          cppNik: existingCustomer!.cppNik,
          cpwNik: existingCustomer!.cpwNik,
          ktpAddress: existingCustomer!.ktpAddress,
          cppAddress: existingCustomer!.cppAddress,
          cpwAddress: existingCustomer!.cpwAddress,
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
      emateraiResult = await generateEmaterai(poNumber, new Date(`${input.eventDate}T00:00:00.000Z`));
    }

    // Approval steps: conditional Sales step + Manager → Finance.
    // Built later (after salesId is known) via buildBookingApprovalSteps.
    const bookingApprovalSteps = await buildBookingApprovalSteps({
      salesId: input.salesId ?? session!.user.profileId!,
      creatorProfileId: session!.user.profileId!,
      signatureSales: input.signatureSales,
      decidedAt: new Date(),
      includeClientStep: true, // Wedding: client TTD step included
    });

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
              emailCpp: leadRecord.email || null,
              emailCpw: null,
              cppNik: null,
              cpwNik: null,
              ktpAddress: leadRecord.address ?? null,
              cppAddress: leadRecord.address ?? null,
              cpwAddress: null,
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
          })
        );
      }
    } else {
      const updates: Record<string, unknown> = {};
      if (input.contactNumbers) updates.mobileNumber = parseContactNumbersToArray(input.contactNumbers) as Prisma.InputJsonValue;
      if (input.contactEmailCpp !== undefined) updates.emailCpp = input.contactEmailCpp || null;
      if (input.contactEmailCpw !== undefined) updates.emailCpw = input.contactEmailCpw || null;
      if (input.contactNikCpp) updates.cppNik = input.contactNikCpp;
      if (input.contactNikCpw) updates.cpwNik = input.contactNikCpw;
      if (input.contactCppAddress !== undefined) updates.cppAddress = input.contactCppAddress || null;
      if (input.contactCpwAddress !== undefined) updates.cpwAddress = input.contactCpwAddress || null;
      if (input.contactBitrixId) updates.bitrixId = input.contactBitrixId;
      if (Object.keys(updates).length > 0) {
        updates.updatedBy = session!.user.name ?? session!.user.email;
        ops.push(db.customer.update({ where: { id: customerId }, data: updates }));
      }
    }

    // Sales auto-detect: use explicit salesId if provided (admin/manager
    // assigning on behalf), otherwise fall back to the caller's own profile.
    const salesId = input.salesId ?? session!.user.profileId!;

    ops.push(
      db.booking.create({
        data: {
          id: bookingId,
          eventDate: new Date(`${input.eventDate}T00:00:00.000Z`),
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
          emailCpp: customerData.emailCpp ?? null,
          emailCpw: customerData.emailCpw ?? null,
          mobileNumber: Array.isArray(customerData.mobileNumber)
            ? (customerData.mobileNumber as Array<{ name?: string; number: string }>)
                .map((e) => (e.name ? `${e.name}: ${e.number}` : e.number))
                .join(", ")
            : String(customerData.mobileNumber ?? ""),
          cppNik: customerData.cppNik,
          cpwNik: customerData.cpwNik,
          ktpAddress: customerData.ktpAddress,
          cppAddress: customerData.cppAddress,
          cpwAddress: customerData.cpwAddress,
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

    // If booking created from a lead → update lead.convertedTo* fields atomically.
    // MUST be pushed AFTER db.booking.create above: the convertedToBookingId FK
    // (leads_convertedToBookingId_fkey) requires the booking row to exist first.
    // Neon HTTP array transactions execute ops in order and check FKs per-statement.
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

    // Snapshot package pax + pricing (with takeout toggle support)
    {
      const toggleMap = new Map(
        (input.categoryToggles ?? []).map((t) => [t.categoryName, t.isTakeout])
      );
      const nominalMap = new Map(
        (input.categoryToggles ?? []).map((t) => [t.categoryName, t.takeoutNominal ?? 0])
      );
      // Resolve which category IDs are taken out, so vendor items can carry the flag
      // directly (matching by categoryId, not fragile categoryName string).
      const takeoutCategoryIds = new Set(
        pkg.categoryPrices
          .filter((c) => c.isShow && (toggleMap.get(c.categoryName) ?? false) && c.categoryId)
          .map((c) => c.categoryId as string),
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
        db.snapPackagePricing.create({
          data: {
            bookingId,
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
          ...pkg.categoryPrices.map((cp) => {
            const isTakeout = cp.isShow ? (toggleMap.get(cp.categoryName) ?? false) : false;
            return db.snapPackageCategoryPrice.create({
              data: {
                bookingId,
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

    if (input.bonuses && input.bonuses.length > 0) {
      ops.push(
        ...input.bonuses.map((bonus) =>
          db.snapBonus.create({ data: { bookingId, vendorId: bonus.vendorId, vendorCategoryId: bonus.vendorCategoryId, vendorName: bonus.vendorName, description: bonus.description ?? null, qty: bonus.qty, nominal: bonus.nominal ?? 0 } })
        )
      );
    }

    if (input.complimentaries && input.complimentaries.length > 0) {
      ops.push(
        ...input.complimentaries.map((c, i) =>
          db.snapComplimentary.create({
            data: {
              bookingId,
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

    if (input.termOfPayments && input.termOfPayments.length > 0) {
      ops.push(
        ...input.termOfPayments.map((t, i) =>
          db.termOfPayment.create({ data: { bookingId, name: t.name, amount: t.amount, dueDate: new Date(t.dueDate), sortOrder: t.sortOrder, invoiceNumber: invoiceNumbers[i], paymentStatus: (t.paymentStatus ?? "unpaid") as "unpaid" | "paid" | "partial" | "refund" } })
        )
      );
    }

    // Add ApprovalRecord + steps to the same transaction (Sales → Manager → Finance).
    // Auto-approve only the Sales step, and only when the creator IS the assigned sales.
    if (bookingApprovalSteps && bookingApprovalSteps.length > 0) {
      const approvalRecordId = crypto.randomUUID();

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

    // Create initial PO revision snapshot + link approval steps + set currentRevisionId
    const revisionId = await createBookingRevision(bookingId, session!.user.profileId!, "Initial booking");
    await db.$transaction([
      db.approvalRecordStep.updateMany({
        where: { record: { module: "booking", entityId: bookingId } },
        data: { revisionId },
      }),
      db.booking.update({
        where: { id: bookingId },
        data: { currentRevisionId: revisionId },
      }),
    ]);

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
    if (isSlotConflictError(e)) {
      return { success: false, error: SLOT_TAKEN_MESSAGE };
    }
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

  if (!session!.user.profileId) return { success: false, error: "Sesi tidak valid, silakan login ulang." };
  const scope = await getProfileDataScope(session!.user.profileId);
  if (!(await canAccessBooking(session!.user.profileId, scope, id))) {
    return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
  }

  try {
    const updateData: Record<string, unknown> = {};
    if (rest.eventDate) updateData.eventDate = new Date(`${rest.eventDate}T00:00:00.000Z`);
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
  } catch (e) {
    if (isSlotConflictError(e)) {
      return { success: false, error: SLOT_TAKEN_MESSAGE };
    }
    return { success: false, error: "Gagal memperbarui booking." };
  }
}

export async function deleteBooking(id: string) {
  const { session, error } = await requirePermission({ module: "booking", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`booking-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  if (!session!.user.profileId) return { success: false, error: "Sesi tidak valid, silakan login ulang." };
  const scope = await getProfileDataScope(session!.user.profileId);
  if (!(await canAccessBooking(session!.user.profileId, scope, id))) {
    return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
  }

  try {
    // Fetch storage file keys before deleting records
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

    // Delete storage files (outside transaction — non-critical)
    if (docs.length > 0) {
      const { deleteFromStorage } = await import("@/lib/storage");
      await Promise.all(
        docs.map((d) => deleteFromStorage(d.filePath).catch((e) => console.error("[deleteBooking] storage:", e)))
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

  if (!session!.user.profileId) return { success: false, error: "Sesi tidak valid, silakan login ulang." };
  const scope = await getProfileDataScope(session!.user.profileId);
  if (!(await canAccessBooking(session!.user.profileId, scope, bookingId))) {
    return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
  }

  try {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: { salesId: true, currentRevisionId: true, sales: { select: { fullName: true } } },
    });
    if (!booking) return { success: false, error: "Booking tidak ditemukan." };

    const targetSales = await db.profile.findUnique({
      where: { id: targetSalesId },
      select: { fullName: true },
    });
    if (!targetSales) return { success: false, error: "Sales tujuan tidak ditemukan." };

    // Reassign the Sales approval step (approverType "user") to the new sales.
    // The step gates on approverUserId, so without this the old sales would keep
    // the ability to approve and the new sales could not. Reset it to pending and
    // clear any signature/decision the old sales had made — the new sales must
    // sign/approve fresh. Only touch the step(s) of the active revision snapshot.
    const approvalRecord = await db.approvalRecord.findUnique({
      where: { module_entityId: { module: "booking", entityId: bookingId } },
      select: { id: true, status: true },
    });
    const salesStep = approvalRecord
      ? await db.approvalRecordStep.findFirst({
          where: {
            recordId: approvalRecord.id,
            approverType: "user",
            ...(booking.currentRevisionId ? { revisionId: booking.currentRevisionId } : {}),
          },
          select: { id: true },
        })
      : null;

    await db.$transaction([
      db.booking.update({ where: { id: bookingId }, data: { salesId: targetSalesId } }),
      ...(salesStep
        ? [
            db.approvalRecordStep.update({
              where: { id: salesStep.id },
              data: {
                approverUserId: targetSalesId,
                status: "pending",
                signature: null,
                decidedById: null,
                decidedAt: null,
              },
            }),
          ]
        : []),
      // A previously fully-approved record is no longer valid: the new sales hasn't
      // approved yet. Send the record (and booking) back to pending.
      ...(approvalRecord && approvalRecord.status === "approved"
        ? [
            db.approvalRecord.update({ where: { id: approvalRecord.id }, data: { status: "pending" } }),
            db.booking.update({ where: { id: bookingId }, data: { bookingStatus: "Pending" } }),
          ]
        : []),
    ]);

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

export async function transferBookingManager(
  bookingId: string,
  targetManagerId: string,
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "booking", action: "transfer-manager" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`booking-transfer-manager:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  if (!bookingId || !targetManagerId) return { success: false, error: "Parameter tidak valid." };

  if (!session!.user.profileId) return { success: false, error: "Sesi tidak valid, silakan login ulang." };
  const scope = await getProfileDataScope(session!.user.profileId);
  if (!(await canAccessBooking(session!.user.profileId, scope, bookingId))) {
    return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
  }

  try {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: { managerId: true, manager: { select: { fullName: true } } },
    });
    if (!booking) return { success: false, error: "Booking tidak ditemukan." };

    const targetManager = await db.profile.findUnique({
      where: { id: targetManagerId },
      select: { fullName: true, role: { select: { name: true } } },
    });
    if (!targetManager) return { success: false, error: "Manager tujuan tidak ditemukan." };
    if (targetManager.role?.name !== "manager") return { success: false, error: "User yang dipilih bukan manager." };

    await db.$transaction([db.booking.update({ where: { id: bookingId }, data: { managerId: targetManagerId } })]);

    await logAudit({
      userId: session!.user.id,
      action: "updated",
      entityType: "booking",
      entityId: bookingId,
      changes: {
        managerId: { from: booking.managerId, to: targetManagerId },
        fromManager: booking.manager?.fullName ?? "Belum ada",
        toManager: targetManager.fullName,
      },
      description: `Transfer manager booking dari ${booking.manager?.fullName ?? "Belum ada"} ke ${targetManager.fullName}`,
    });

    revalidateTag("bookings", "max");
    return { success: true };
  } catch {
    return { success: false, error: "Gagal mentransfer manager booking." };
  }
}

// ─── Update Booking Client Info (Step 1 — no approval trigger) ───────────────
/** Updates ONLY client/customer fields on a saved booking. Does NOT touch venue,
 *  package, term of payments, or approval state. Used by Edit Drawer Step 1
 *  "Save & Publish" button. */
export async function updateBookingClientInfo(data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "booking", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`booking-client-info:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateBookingClientInfoSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Validasi gagal." };

  const { id, customerName, contactNumbers, contactEmailCpp, contactEmailCpw, contactNikCpp, contactNikCpw, contactCppAddress, contactCpwAddress, contactBitrixId, salesId, sourceOfInformationId } = parsed.data;

  if (!session!.user.profileId) return { success: false, error: "Sesi tidak valid, silakan login ulang." };
  const scope = await getProfileDataScope(session!.user.profileId);
  if (!(await canAccessBooking(session!.user.profileId, scope, id))) {
    return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
  }

  try {
    const booking = await db.booking.findUnique({
      where: { id },
      select: { customerId: true, snapCustomer: { select: { name: true, mobileNumber: true } } },
    });
    if (!booking) return { success: false, error: "Booking tidak ditemukan." };

    const contactDisplay = serializeContactNumbersToDisplay(contactNumbers ?? "");
    const contactArray = parseContactNumbersToArray(contactNumbers ?? "");

    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.booking.update({
        where: { id },
        data: {
          sourceOfInformationId: sourceOfInformationId ?? undefined,
          ...(salesId != null ? { salesId } : {}),
        },
      }),
      db.snapCustomer.update({
        where: { bookingId: id },
        data: {
          name: customerName,
          mobileNumber: contactDisplay || "-",
          emailCpp: contactEmailCpp || null,
          emailCpw: contactEmailCpw || null,
          cppNik: contactNikCpp || null,
          cpwNik: contactNikCpw || null,
          cppAddress: contactCppAddress || null,
          cpwAddress: contactCpwAddress || null,
        },
      }),
      db.customer.update({
        where: { id: booking.customerId },
        data: {
          name: customerName,
          mobileNumber: contactArray as Prisma.InputJsonValue,
          emailCpp: contactEmailCpp || null,
          emailCpw: contactEmailCpw || null,
          cppNik: contactNikCpp || null,
          cpwNik: contactNikCpw || null,
          cppAddress: contactCppAddress || null,
          cpwAddress: contactCpwAddress || null,
          bitrixId: contactBitrixId || null,
          updatedBy: session!.user.name ?? session!.user.email,
        },
      }),
    ];

    await db.$transaction(ops);

    await logAudit({
      userId: session!.user.id,
      action: "updated",
      entityType: "booking",
      entityId: id,
      changes: {
        scope: "client-info-only",
        customerName,
      },
      description: `Updated client info for booking ${id}`,
    });

    revalidateTag("bookings", "max");
    revalidateTag("customers", "max");
    return { success: true };
  } catch {
    return { success: false, error: "Gagal mengupdate informasi client." };
  }
}

export async function editBooking(data: unknown) {
  const { session, error } = await requirePermission({ module: "booking", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`booking-edit:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = editBookingSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { id, customerName, contactNumbers, contactEmailCpp, contactEmailCpw, contactNikCpp, contactNikCpw, contactCppAddress, contactCpwAddress, contactBitrixId, ...rest } = parsed.data;

  if (!session!.user.profileId) return { success: false, error: "Sesi tidak valid, silakan login ulang." };
  const scope = await getProfileDataScope(session!.user.profileId);
  if (!(await canAccessBooking(session!.user.profileId, scope, id))) {
    return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
  }

  try {
    const booking = await db.booking.findUnique({
      where: { id },
      select: {
        customerId: true, salesId: true, venueId: true, packageId: true,
        eventDate: true, weddingSession: true, weddingType: true,
        paymentMethodId: true, sourceOfInformationId: true,
        discountName: true, discountAmount: true, currentRevisionId: true, poNumber: true,
        snapCustomer: { select: { name: true, mobileNumber: true, emailCpp: true, emailCpw: true } },
        snapComplimentaries: {
          select: { name: true, price: true, isShowPrice: true, description: true, qty: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    if (!booking) return { success: false, error: "Booking tidak ditemukan." };

    // ── Venue availability conflict check (WEDDINGS only — MICE has no weddingSession) ──
    // Exclude the current booking so it doesn't conflict with itself.
    if (rest.weddingSession) {
      const eventDateObj = new Date(`${rest.eventDate}T00:00:00.000Z`);
      const conflictingBooking = await db.booking.findFirst({
        where: {
          id: { not: id },
          venueId: rest.venueId,
          recordStatus: "saved",
          eventDate: eventDateObj,
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
    const typeChanged = (rest.weddingType ?? null) !== (booking.weddingType ?? null);
    // shouldRefreshPrice = true saat paket beda (packageChanged) ATAU user re-select
    // paket yang sama (refreshPackagePrice signal dari drawer). Pada keduanya kita fetch
    // master price terbaru dan rebuild snapshot pricing + snapPackageCategoryPrices.
    const shouldRefreshPrice = packageChanged || rest.refreshPackagePrice === true;

    // ── Material change detection ─────────────────────────────────────────────
    // Compare event date: rest.eventDate is "yyyy-MM-dd"; booking.eventDate is stored as UTC midnight.
    // Compare as date strings using UTC getters so the check is timezone-independent.
    const newEventDate = rest.eventDate; // already "yyyy-MM-dd"
    const ed = booking.eventDate!; // saved bookings always have eventDate
    const oldEventDate = `${ed.getUTCFullYear()}-${String(ed.getUTCMonth() + 1).padStart(2, "0")}-${String(ed.getUTCDate()).padStart(2, "0")}`;
    const eventDateChanged = newEventDate !== oldEventDate;

    // Compare discount
    const newDiscountName = rest.specialBonusName ?? null;
    const newDiscountAmount = rest.specialBonusAmount ?? 0;
    const discountChanged =
      newDiscountName !== booking.discountName ||
      newDiscountAmount !== (booking.discountAmount ?? 0);

    // Compare takeout toggles against current snapPackageCategoryPrices
    let takeoutChanged = false;
    if (parsed.data.categoryToggles && parsed.data.categoryToggles.length > 0) {
      const currentSnaps = await db.snapPackageCategoryPrice.findMany({
        where: { bookingId: id },
        select: { categoryName: true, isTakeout: true, takeoutNominal: true, isShow: true },
      });
      const currentTakeoutMap = new Map(
        currentSnaps.filter((c) => c.isShow).map((c) => [c.categoryName, { isTakeout: c.isTakeout, takeoutNominal: c.takeoutNominal ?? 0 }])
      );
      for (const t of parsed.data.categoryToggles) {
        if (!t.isShow) continue;
        const cur = currentTakeoutMap.get(t.categoryName);
        if (!cur) { takeoutChanged = true; break; }
        if (cur.isTakeout !== t.isTakeout) { takeoutChanged = true; break; }
        if (t.isTakeout && cur.takeoutNominal !== (t.takeoutNominal ?? 0)) { takeoutChanged = true; break; }
      }
    }

    // Compare term of payments. Three distinct signals:
    //  • topChanged       — structural change (count, names, amounts, order). Material.
    //  • topStatusChanged — any payment-status delta (either direction). Forces a write.
    //  • paidReversed      — a paid/refund term sent back as unpaid. Material (re-approval)
    //                        AND its payment proof must be cleared.
    let topChanged = false;
    let topStatusChanged = false;
    let topSortOrderChanged = false;
    let paidReversed = false;
    if (rest.termOfPayments && rest.termOfPayments.length > 0) {
      const currentTerms = await db.termOfPayment.findMany({
        where: { bookingId: id },
        select: { id: true, name: true, amount: true, dueDate: true, sortOrder: true, paymentStatus: true, ackStatus: true },
        orderBy: { sortOrder: "asc" },
      });
      const newTerms = rest.termOfPayments;

      // dueDate is stored as a DateTime (UTC midnight); the client sends a
      // "yyyy-MM-dd" string. Normalise the stored value to the same string
      // form before comparing so a pure date change is detected as material.
      const toYmd = (d: Date | null): string =>
        d ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}` : "";

      // Structural comparison is id-based, not index-based. This prevents drag-reorder
      // (sortOrder change) from being treated as a material change. A term is structural
      // when: added (no id on client side), removed (existing id not in client payload),
      // or has a name/amount/dueDate change. sortOrder-only changes are non-material
      // (display reorder) but still need a write so they are tracked separately.
      const dbById = new Map(currentTerms.map((t) => [t.id, t]));
      const clientIds = new Set(newTerms.filter((t) => t.id).map((t) => t.id as string));

      // Term removed from client (and it's not a new term with no id)
      const removedTermIds = currentTerms.filter((t) => !clientIds.has(t.id));
      if (removedTermIds.length > 0) topChanged = true;

      if (!topChanged) {
        for (const nw of newTerms) {
          if (!nw.id) {
            // New term (no existing id) — structural addition
            topChanged = true;
            break;
          }
          const cur = dbById.get(nw.id);
          if (!cur) {
            // Client sent an id that doesn't exist in DB — treat as new (structural)
            topChanged = true;
            break;
          }
          if (
            cur.name !== nw.name ||
            cur.amount !== nw.amount ||
            toYmd(cur.dueDate) !== nw.dueDate
          ) {
            topChanged = true;
            break;
          }
          // sortOrder-only change: non-material but requires a write to persist the reorder
          if (cur.sortOrder !== nw.sortOrder) {
            topSortOrderChanged = true;
          }
        }
      }

      // Payment-status deltas — compared by term id (robust to ordering). Finance-
      // acknowledged terms are locked and excluded; only unpaid/paid from the client
      // are honoured (partial/refund are managed by the finance flows, not here).
      for (const nw of newTerms) {
        if (!nw.id) continue; // new term — covered by the structural path
        const cur = dbById.get(nw.id);
        if (!cur || cur.ackStatus === "acknowledged") continue;
        const clientStatus = nw.paymentStatus;
        if (clientStatus !== "paid" && clientStatus !== "unpaid") continue;
        if (clientStatus !== cur.paymentStatus) {
          topStatusChanged = true;
          if ((cur.paymentStatus === "paid" || cur.paymentStatus === "refund") && clientStatus === "unpaid") {
            paidReversed = true;
          }
        }
      }
    }

    // refreshPackagePrice (re-select same package): detect whether the master price
    // ACTUALLY changed compared to the current snapshot. If harga sama → no-op (no
    // material change, no revision). Only a real price delta counts as material.
    // This runs ONLY when shouldRefreshPrice=true but packageChanged=false (same pkg).
    let priceRefreshed = false;
    if (shouldRefreshPrice && !packageChanged) {
      const [masterPkg, snapPricing] = await Promise.all([
        db.package.findUnique({
          where: { id: rest.packageId },
          select: { margin: true, sellingPrice: true, categoryPrices: { select: { basePrice: true, isShow: true, categoryName: true, sortOrder: true } } },
        }),
        db.snapPackagePricing.findUnique({
          where: { bookingId: id },
          select: { fullPrice: true },
        }),
      ]);
      if (masterPkg && snapPricing) {
        const newFullPrice = computeFullPrice(masterPkg.categoryPrices, masterPkg.margin ?? 0, masterPkg.sellingPrice);
        priceRefreshed = newFullPrice !== snapPricing.fullPrice;
      }
    }

    // Compare complimentaries: field-based diff against current DB snapshot.
    // Full-replace write semantics (delete+recreate) means no stable client-side id —
    // compare by count + content instead. Normalization: trim strings, cast numerics,
    // treat null/"" as equivalent for description.
    let complimentaryChanged = false;
    if (parsed.data.complimentaries !== undefined) {
      const existing = booking.snapComplimentaries;
      const incoming = parsed.data.complimentaries;
      if (existing.length !== incoming.length) {
        complimentaryChanged = true;
      } else {
        for (let ci = 0; ci < existing.length; ci++) {
          const ex = existing[ci];
          const inc = incoming[ci];
          const exDesc = ex.description?.trim() || null;
          const incDesc = inc.description?.trim() || null;
          if (
            ex.name.trim() !== inc.name.trim() ||
            ex.price !== inc.price ||
            ex.isShowPrice !== inc.isShowPrice ||
            exDesc !== incDesc ||
            ex.qty !== inc.qty
          ) {
            complimentaryChanged = true;
            break;
          }
        }
      }
    }

    // unpaid→paid persists WITHOUT resetting approval; a paid→unpaid reversal IS
    // material (paidReversed) and re-triggers the approval revision flow below.
    const hasMaterialChange =
      venueChanged ||
      packageChanged ||
      priceRefreshed ||
      eventDateChanged ||
      discountChanged ||
      takeoutChanged ||
      topChanged ||
      paidReversed ||
      complimentaryChanged;
    // Terms must be re-written whenever structure, status, or sort-order changed.
    // sortOrder-only change (drag reorder) is non-material but still needs a write
    // so the new display order is persisted correctly.
    const termsNeedWrite = topChanged || topStatusChanged || topSortOrderChanged;

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
          eventDate: new Date(`${rest.eventDate}T00:00:00.000Z`),
          venueId: rest.venueId,
          packageId: rest.packageId,
          paymentMethodId: rest.paymentMethodId ?? null,
          sourceOfInformationId: rest.sourceOfInformationId ?? null,
          weddingSession: rest.weddingSession ?? null,
          weddingType: rest.weddingType ?? null,
          signingLocation: rest.signingLocation ?? null,
          ...(rest.eventTime !== undefined && { eventTime: rest.eventTime || null }),
          ...(rest.notes !== undefined && { notes: rest.notes || null }),
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
          emailCpp: contactEmailCpp || null,
          emailCpw: contactEmailCpw || null,
          cppNik: contactNikCpp || null,
          cpwNik: contactNikCpw || null,
          ktpAddress: null,
          cppAddress: contactCppAddress || null,
          cpwAddress: contactCpwAddress || null,
        },
      }),
      // Update actual customer — mobileNumber is a Json column (structured array)
      db.customer.update({
        where: { id: booking.customerId },
        data: {
          name: customerName,
          mobileNumber: parseContactNumbersToArray(contactNumbers ?? "") as Prisma.InputJsonValue,
          emailCpp: contactEmailCpp || null,
          emailCpw: contactEmailCpw || null,
          cppNik: contactNikCpp || null,
          cpwNik: contactNikCpw || null,
          ktpAddress: null,
          cppAddress: contactCppAddress || null,
          cpwAddress: contactCpwAddress || null,
          bitrixId: contactBitrixId || null,
          updatedBy: session!.user.name ?? session!.user.email,
        },
      }),
    ];

    // Fetch new venue data when venue changed (needed for both snap update and PO recompute).
    // Also fetched when only the event type changed so we have brand/code for PO rebuild.
    let fetchedVenue: { id: string; name: string; code: string; address: string | null; description: string | null; brand: { name: string; code: string } | null } | null = null;
    if (venueChanged || typeChanged) {
      fetchedVenue = await db.venue.findUniqueOrThrow({
        where: { id: rest.venueId },
        select: {
          id: true,
          name: true,
          code: true,
          address: true,
          description: true,
          brand: { select: { name: true, code: true } },
        },
      });
    }

    // Update venue snapshot if venue changed
    if (venueChanged && fetchedVenue) {
      ops.push(
        db.snapVenue.update({
          where: { bookingId: id },
          data: {
            venueId: fetchedVenue.id,
            venueName: fetchedVenue.name,
            address: fetchedVenue.address,
            description: fetchedVenue.description,
            brandName: fetchedVenue.brand?.name ?? null,
            brandCode: fetchedVenue.brand?.code ?? null,
          },
        })
      );
    }

    // Recompute poNumber when venue or event type changed.
    // - seq (running number) and dealing-date segment are preserved from the stored PO.
    // - brandCode, venueCode, eventTypeCode are re-derived from the new venue/type.
    // Fail-safe: if the stored PO doesn't match the expected 5-segment format (legacy/custom),
    // skip the update entirely rather than corrupting it.
    if ((venueChanged || typeChanged) && fetchedVenue && booking.poNumber) {
      const oldSegments = booking.poNumber.split("/");
      if (oldSegments.length === 5) {
        const [oldSeq, , , , oldDate] = oldSegments;
        const newBrandCode = fetchedVenue.brand?.code ?? "";
        const newVenueCode = fetchedVenue.code;
        const newTypeCode = rest.weddingType ?? "R";
        const newPoNumber = `${oldSeq}/${newBrandCode}/${newVenueCode}/${newTypeCode}/${oldDate}`;
        ops.push(
          db.booking.update({ where: { id }, data: { poNumber: newPoNumber } })
        );
      }
      // If segment count != 5: legacy format — leave poNumber untouched (no push).
    }

    // Update package snapshots if package changed OR master price was re-fetched
    // (shouldRefreshPrice: user re-selected same package — refresh master price from DB).
    if (shouldRefreshPrice) {
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
      const nominalMap = new Map(
        (parsed.data.categoryToggles ?? []).map((t) => [t.categoryName, t.takeoutNominal ?? 0])
      );
      const takeoutCategoryIds = new Set(
        newPkg.categoryPrices
          .filter((c) => c.isShow && (toggleMap.get(c.categoryName) ?? false) && c.categoryId)
          .map((c) => c.categoryId as string),
      );
      // Unified price model: fullPrice anchor − Σ(takeout nominal). UI == DB.
      const fullPrice = computeFullPrice(newPkg.categoryPrices, newPkg.margin ?? 0, newPkg.sellingPrice);
      const pkgPrice = calcFinalFromFullPrice(
        newPkg.categoryPrices.map((c) => ({
          isShow: c.isShow,
          isTakeout: c.isShow ? (toggleMap.get(c.categoryName) ?? false) : false,
          basePrice: c.basePrice,
          takeoutNominal: nominalMap.get(c.categoryName) ?? 0,
        })),
        fullPrice,
      );

      ops.push(
        db.snapPackagePricing.upsert({
          where: { bookingId: id },
          create: {
            bookingId: id,
            packageId: newPkg.id,
            packageName: newPkg.packageName,
            pax: newPkg.pax,
            price: pkgPrice,
            fullPrice,
            margin: newPkg.margin ?? 0,
            termAndCondition: newPkg.termAndCondition ?? null,
          },
          update: {
            packageId: newPkg.id,
            packageName: newPkg.packageName,
            pax: newPkg.pax,
            price: pkgPrice,
            fullPrice,
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
        ...newPkg.categoryPrices.map((cp) => {
          const isTakeout = cp.isShow ? (toggleMap.get(cp.categoryName) ?? false) : false;
          return db.snapPackageCategoryPrice.create({
            data: {
              bookingId: id,
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
    } else if (takeoutChanged) {
      // Takeout-only change (no package swap): update isTakeout flags on existing snapshot
      // rows instead of deleting & recreating them. This preserves snapshot data (itemText,
      // sortOrder, etc.) that was captured at booking-create time and may differ from the
      // current master package.

      const toggleMap = new Map(
        (parsed.data.categoryToggles ?? []).map((t) => [t.categoryName, t.isTakeout])
      );
      const nominalMap = new Map(
        (parsed.data.categoryToggles ?? []).map((t) => [t.categoryName, t.takeoutNominal ?? 0])
      );

      // Fetch existing snap category prices with id + categoryId so we can:
      //  1. Build the takeoutCategoryIds set (for vendor item update).
      //  2. Update each snapPackageCategoryPrice row individually.
      const existingSnapCats = await db.snapPackageCategoryPrice.findMany({
        where: { bookingId: id },
        select: { id: true, categoryId: true, categoryName: true, basePrice: true, isShow: true },
      });

      const takeoutCategoryIds = new Set(
        existingSnapCats
          .filter((c) => c.isShow && (toggleMap.get(c.categoryName) ?? false) && c.categoryId)
          .map((c) => c.categoryId as string),
      );

      // Re-compute the final price using the existing fullPrice anchor (unchanged).
      const snapPricing = await db.snapPackagePricing.findUniqueOrThrow({
        where: { bookingId: id },
        select: { fullPrice: true },
      });
      const pkgPrice = calcFinalFromFullPrice(
        existingSnapCats.map((c) => ({
          isShow: c.isShow,
          isTakeout: c.isShow ? (toggleMap.get(c.categoryName) ?? false) : false,
          basePrice: c.basePrice,
          takeoutNominal: nominalMap.get(c.categoryName) ?? 0,
        })),
        snapPricing.fullPrice,
      );

      // Fetch existing vendor item snap rows (we update isTakeout in-place).
      const existingSnapVendorItems = await db.snapPackageVendorItem.findMany({
        where: { bookingId: id },
        select: { id: true, categoryId: true },
      });

      ops.push(
        // Update the final price on snapPackagePricing (fullPrice stays the same).
        db.snapPackagePricing.update({
          where: { bookingId: id },
          data: { price: pkgPrice },
        }),
        // Update isTakeout + takeoutNominal on each snapPackageCategoryPrice row.
        ...existingSnapCats.map((cp) => {
          const isTakeout = cp.isShow ? (toggleMap.get(cp.categoryName) ?? false) : false;
          return db.snapPackageCategoryPrice.update({
            where: { id: cp.id },
            data: {
              isTakeout,
              takeoutNominal: isTakeout ? ((nominalMap.get(cp.categoryName) ?? 0) || cp.basePrice) : 0,
            },
          });
        }),
        // Update isTakeout on each snapPackageVendorItem row.
        ...existingSnapVendorItems.map((item) =>
          db.snapPackageVendorItem.update({
            where: { id: item.id },
            data: {
              isTakeout: item.categoryId ? takeoutCategoryIds.has(item.categoryId) : false,
            },
          })
        ),
      );
    }

    // Bonuses (legacy) — replace existing atomically within transaction
    if (parsed.data.bonuses && parsed.data.bonuses.length > 0) {
      ops.push(
        db.snapBonus.deleteMany({ where: { bookingId: id } }),
        ...parsed.data.bonuses.map((bonus) =>
          db.snapBonus.create({ data: { bookingId: id, vendorId: bonus.vendorId, vendorCategoryId: bonus.vendorCategoryId, vendorName: bonus.vendorName, description: bonus.description ?? null, qty: bonus.qty, nominal: bonus.nominal ?? 0 } })
        )
      );
    }

    // Complimentaries — replace existing atomically within transaction
    if (parsed.data.complimentaries !== undefined) {
      ops.push(db.snapComplimentary.deleteMany({ where: { bookingId: id } }));
      if (parsed.data.complimentaries.length > 0) {
        ops.push(
          ...parsed.data.complimentaries.map((c, i) =>
            db.snapComplimentary.create({
              data: {
                bookingId: id,
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
    }

    // Storage keys of payment proofs to delete AFTER the transaction commits (paid→unpaid).
    // Collected here, deleted best-effort post-commit so a failed delete never rolls
    // back the booking update.
    const evidenceKeysToDelete: string[] = [];

    // Term of payments — re-write when structure OR payment status changed.
    if (termsNeedWrite && rest.termOfPayments && rest.termOfPayments.length > 0) {
      // Re-fetch existing terms from DB to detect locked terms server-side.
      // We NEVER trust client-sent paymentStatus / ackStatus for authorization.
      const dbTerms = await db.termOfPayment.findMany({
        where: { bookingId: id },
        select: { id: true, name: true, amount: true, paymentStatus: true, ackStatus: true, paymentEvidence: true },
      });
      const dbTermById = new Map(dbTerms.map((t) => [t.id, t]));

      // A term is locked when it has been paid, refunded, or acknowledged by finance.
      // Locked terms must NOT be silently deleted; their data may still be updated via
      // the explicit pencil-click gesture (the authorization signal).
      const isLockedTerm = (t: { paymentStatus: string; ackStatus: string }) =>
        t.paymentStatus === "paid" ||
        t.paymentStatus === "refund" ||
        t.ackStatus === "acknowledged";

      const lockedTermIds = new Set(
        dbTerms.filter(isLockedTerm).map((t) => t.id),
      );

      // Client-sent term IDs that are still in DB (the rest are new terms).
      const clientTermIds = rest.termOfPayments.filter((t) => t.id).map((t) => t.id!);

      // Locked terms must always be preserved — include them in the "keep" set
      // even if the client somehow didn't include them in the payload.
      const keepIds = new Set([...clientTermIds, ...lockedTermIds]);

      ops.push(
        // Delete only terms that are NOT locked and NOT sent by the client.
        db.termOfPayment.deleteMany({ where: { bookingId: id, id: { notIn: [...keepIds] } } }),
        ...rest.termOfPayments.map((t) => {
          if (t.id) {
            const cur = dbTermById.get(t.id);
            // Resolve the status to persist. Finance-acknowledged terms are immutable —
            // keep their stored status. Otherwise honour client unpaid/paid only;
            // partial/refund are owned by the finance flows, so fall back to stored.
            let nextStatus = cur?.paymentStatus;
            if (cur && cur.ackStatus !== "acknowledged") {
              if (t.paymentStatus === "paid" || t.paymentStatus === "unpaid") {
                nextStatus = t.paymentStatus;
              }
            }
            // paid/refund → unpaid: clear the proof and queue the storage object for deletion.
            const reversedToUnpaid =
              !!cur &&
              cur.ackStatus !== "acknowledged" &&
              (cur.paymentStatus === "paid" || cur.paymentStatus === "refund") &&
              nextStatus === "unpaid";
            if (reversedToUnpaid && cur?.paymentEvidence) {
              evidenceKeysToDelete.push(cur.paymentEvidence);
            }
            return db.termOfPayment.update({
              where: { id: t.id },
              data: {
                name: t.name,
                amount: t.amount,
                dueDate: new Date(t.dueDate),
                sortOrder: t.sortOrder,
                ...(nextStatus !== undefined && { paymentStatus: nextStatus }),
                ...(reversedToUnpaid && { paymentEvidence: null }),
              },
            });
          }
          // New term (no id) — always allowed. New terms can only be created as unpaid;
          // marking paid requires a real id + evidence upload via the dedicated endpoint.
          return db.termOfPayment.create({
            data: {
              bookingId: id,
              name: t.name,
              amount: t.amount,
              dueDate: new Date(t.dueDate),
              sortOrder: t.sortOrder,
              paymentStatus: t.paymentStatus === "paid" ? "paid" : "unpaid",
            },
          });
        })
      );
    }

    // Edit selesai di-commit → buang buffer edit-draft jika ada, ATOMIK bersama
    // write utama. Ditaruh di dalam transaksi (bukan sequential setelahnya) supaya
    // jika langkah approval/revisi di bawah gagal, draft tetap terhapus dan badge
    // "Sedang diedit" tidak nyangkut. deleteMany = idempotent (no-op kalau tidak ada).
    ops.push(db.bookingEditDraft.deleteMany({ where: { bookingId: id } }));

    await db.$transaction(ops);

    // Best-effort: delete payment-proof objects for terms reverted paid→unpaid.
    // Runs post-commit so a storage failure never rolls back the booking write.
    if (evidenceKeysToDelete.length > 0) {
      await Promise.allSettled(
        evidenceKeysToDelete.map(async (key) => {
          try {
            await deleteFromStorage(key);
          } catch (err) {
            console.error("[editBooking] Failed to delete reverted payment evidence", key, err);
          }
        })
      );
    }

    // Snapshot approval + create revision — when any material change detected
    if (hasMaterialChange) {
      const reasons: string[] = [];
      if (venueChanged) reasons.push("venue");
      if (packageChanged) reasons.push("package");
      if (priceRefreshed) reasons.push("package price refreshed");
      if (eventDateChanged) reasons.push("event date");
      if (discountChanged) reasons.push("discount");
      if (takeoutChanged) reasons.push("takeout");
      if (topChanged) reasons.push("terms of payment");
      if (paidReversed) reasons.push("payment reversed to unpaid");
      if (complimentaryChanged) reasons.push("complimentary changed");
      const revisionId = await createBookingRevision(id, session!.user.profileId!, `Changed ${reasons.join(", ")}`);

      const approvalRecord = await db.approvalRecord.findUnique({
        where: { module_entityId: { module: "booking", entityId: id } },
        select: { id: true },
      });
      if (approvalRecord) {
        // SNAPSHOT approach: do NOT delete old steps — they stay as history.
        // Build new steps for this revision only. Old steps remain linked to
        // their old revisionId (historical record). New steps get the new revisionId.
        const editApprovalSteps = await buildBookingApprovalSteps({
          salesId: booking.salesId,
          creatorProfileId: session!.user.profileId!,
          signatureSales: rest.signatureSales,
          decidedAt: new Date(),
          includeClientStep: true, // Wedding: client TTD step included
        });

        if (editApprovalSteps && editApprovalSteps.length > 0) {
          const newStepOps: Prisma.PrismaPromise<unknown>[] = editApprovalSteps.map((step) =>
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
                revisionId,
              },
            })
          );

          // Update approval record to pending + booking to Pending + set currentRevisionId
          // Old steps are kept untouched (snapshot, not reset)
          await db.$transaction([
            db.approvalRecord.update({ where: { id: approvalRecord.id }, data: { status: "pending" } }),
            db.booking.update({ where: { id }, data: { bookingStatus: "Pending", currentRevisionId: revisionId } }),
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
    } // end if hasMaterialChange

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
        if (contactEmailCpp !== (booking.snapCustomer?.emailCpp ?? "")) diff.emailCpp = contactEmailCpp;
        if (contactEmailCpw !== (booking.snapCustomer?.emailCpw ?? "")) diff.emailCpw = contactEmailCpw;
        if (rest.eventDate !== booking.eventDate!.toISOString().split("T")[0]) diff.eventDate = rest.eventDate;
        if ((rest.weddingSession ?? "") !== (booking.weddingSession ?? "")) diff.weddingSession = rest.weddingSession;
        if ((rest.weddingType ?? "") !== (booking.weddingType ?? "")) diff.weddingType = rest.weddingType;

        if (hasMaterialChange) {
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
          if (eventDateChanged) diff.eventDate = `${oldEventDate} → ${newEventDate}`;
          if (discountChanged) {
            const discount = newDiscountAmount;
            const oldDiscount = booking.discountAmount ?? 0;
            diff.discount = `${fmtNum(oldDiscount)} → ${newDiscountName ?? "Discount"}: -${fmtNum(discount)}`;
            const newPrice = newSnapPV?.price ?? 0;
            diff.priceAfterDiscount = fmtNum(Math.max(0, newPrice - discount));
          }
          if (takeoutChanged) diff.takeout = "Takeout categories updated";
          if (topChanged) diff.termOfPayments = "Terms of payment updated";
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

  if (!session!.user.profileId) return { success: false, error: "Sesi tidak valid, silakan login ulang." };
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

