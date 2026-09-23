"use server";

import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { getNextSequence } from "@/lib/counter";
import { buildBookingApprovalSteps, resolveApprovalSteps } from "@/lib/approval-flows";
import { resolveManagerId } from "@/lib/resolve-manager";
import { generateAccessCode } from "@/lib/access-code";
import {
  createQuotationSchema,
  updateQuotationSchema,
  type CreateQuotationInput,
  type UpdateQuotationInput,
} from "@/lib/validations/quotation";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getRequestMeta(): Promise<{ ipAddress: string; userAgent: string }> {
  const hdrs = await headers();
  return {
    ipAddress: hdrs.get("x-forwarded-for") ?? "unknown",
    userAgent: hdrs.get("user-agent") ?? "unknown",
  };
}

function computePricing(
  items: CreateQuotationInput["items"],
  additionals: CreateQuotationInput["additionals"],
  prices: CreateQuotationInput["prices"],
  discount: number,
): {
  subtotal: number;
  totalPrice: number;
} {
  const itemsTotal = items.reduce((sum, item) => sum + item.total, 0);
  const additionalsTotal = additionals.reduce((sum, item) => sum + item.total, 0);
  const pricesTotal = prices.reduce((sum, p) => sum + p.total, 0);
  const subtotal = itemsTotal + additionalsTotal + pricesTotal;
  const totalPrice = Math.max(0, subtotal - discount);
  return { subtotal, totalPrice };
}

/**
 * Resolve the bank details to freeze onto a quotation.
 *
 * Quotation stores its own bankName / bankAccountNumber / bankRecipient instead of
 * rendering PaymentMethod through a join, so that editing a venue's bank account
 * later cannot rewrite the Term & Payment block of an already-issued document.
 * Returns nulls when no payment method is selected or it no longer exists.
 */
async function resolveFrozenBankDetails(
  paymentMethodId: string | null | undefined,
): Promise<{ bankName: string | null; bankAccountNumber: string | null; bankRecipient: string | null }> {
  if (!paymentMethodId) return { bankName: null, bankAccountNumber: null, bankRecipient: null };
  const method = await db.paymentMethod.findUnique({
    where: { id: paymentMethodId },
    select: { bankName: true, bankAccountNumber: true, bankRecipient: true },
  });
  return {
    bankName: method?.bankName ?? null,
    bankAccountNumber: method?.bankAccountNumber ?? null,
    bankRecipient: method?.bankRecipient ?? null,
  };
}

async function generateQuotationNo(): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`quotation-MICE-${year}`);
  const padded = seq.toString().padStart(3, "0");
  return `#${padded}-MICE`;
}

/**
 * Freeze the selected MICE package into snap_quotation_packages + children so the
 * quotation document stays stable even if the master package changes later.
 * Returns an empty array when the package no longer exists.
 */
async function buildPackageSnapshotOps(
  quotationId: string,
  packageId: string,
  packageName: string,
  pax: number,
): Promise<Prisma.PrismaPromise<unknown>[]> {
  const pkg = await db.package.findUnique({
    where: { id: packageId },
    include: {
      venue: { select: { name: true } },
      eventType: { select: { name: true } },
      miceItems: { orderBy: { sortOrder: "asc" as const } },
      micePrices: { orderBy: { sortOrder: "asc" as const } },
      taxDeposits: { orderBy: { sortOrder: "asc" as const } },
      complimentaries: { orderBy: { sortOrder: "asc" as const } },
      bonuses: { orderBy: { sortOrder: "asc" as const } },
    },
  });
  if (!pkg) return [];

  const snapId = crypto.randomUUID();
  return [
    db.snapQuotationPackage.create({
      data: {
        id: snapId,
        quotationId,
        packageId,
        packageName,
        pax,
        venueId: pkg.venueId ?? null,
        venueName: pkg.venue?.name ?? null,
        eventTypeId: pkg.eventTypeId ?? null,
        eventTypeName: pkg.eventType?.name ?? null,
        paymentMethodId: pkg.paymentMethodId ?? null,
      },
    }),
    ...pkg.miceItems.map((it, i) =>
      db.snapQuotationPackageItem.create({
        data: { snapPackageId: snapId, itemName: it.itemName, itemDescription: it.itemDescription, sortOrder: i },
      }),
    ),
    ...pkg.micePrices.map((p, i) =>
      db.snapQuotationPackagePrice.create({
        data: { snapPackageId: snapId, name: p.name, description: p.description, priceType: p.priceType, qty: p.qty, price: p.price, total: p.total, sortOrder: i },
      }),
    ),
    ...pkg.taxDeposits.map((t, i) =>
      db.snapQuotationPackageTaxDeposit.create({
        data: { snapPackageId: snapId, name: t.name, nominal: t.nominal, sortOrder: i },
      }),
    ),
    ...pkg.complimentaries.map((c, i) =>
      db.snapQuotationPackageComplimentary.create({
        data: { snapPackageId: snapId, complimentaryId: c.complimentaryId, name: c.name, price: c.price, isShowPrice: c.isShowPrice, description: c.description, qty: c.qty, sortOrder: i },
      }),
    ),
    ...pkg.bonuses.map((b, i) =>
      db.snapQuotationPackageBonus.create({
        data: { snapPackageId: snapId, bonusId: b.bonusId, name: b.name, price: b.price, description: b.description, qty: b.qty, sortOrder: i },
      }),
    ),
  ];
}

// ── Create ─────────────────────────────────────────────────────────────────────

export async function createQuotation(
  data: unknown,
): Promise<{ success: true; data: { id: string; quotationNo: string | null } } | { success: false; error: string }> {
  const { session, error } = await requirePermission({ module: "quotations", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`quotation-create:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = createQuotationSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const input = parsed.data;
  const meta = await getRequestMeta();

  try {
    const quotationId = crypto.randomUUID();
    const quotationNo = await generateQuotationNo();
    const bankDetails = await resolveFrozenBankDetails(input.paymentMethodId);
    const { subtotal, totalPrice } = computePricing(input.items, input.additionals, input.prices, input.discount);

    // A quotation without an approval flow could never be converted safely.
    const approvalSteps = await resolveApprovalSteps("quotations");
    if (!approvalSteps || approvalSteps.length === 0) {
      return { success: false, error: "Alur approval quotation belum dikonfigurasi." };
    }

    const ops: Prisma.PrismaPromise<unknown>[] = [
      // 1. Create quotation row first (items/terms FK depend on it)
      db.quotation.create({
        data: {
          id: quotationId,
          quotationNo,
          status: "draft",
          clientName: input.clientName,
          clientPhone: input.clientPhone ?? "",
          instansi: input.instansi ?? null,
          salesId: input.salesId,
          venueId: input.venueId ?? null,
          paymentMethodId: input.paymentMethodId ?? null,
          bankName: bankDetails.bankName,
          bankAccountNumber: bankDetails.bankAccountNumber,
          bankRecipient: bankDetails.bankRecipient,
          venueName: input.venueName ?? null,
          eventTypeId: input.eventTypeId ?? null,
          eventTypeName: input.eventTypeName ?? null,
          packageId: input.packageId ?? null,
          packageName: input.packageName ?? null,
          pax: input.pax,
          packageSource: input.packageSource ?? null,
          eventDate: input.eventDate ? new Date(input.eventDate) : null,
          eventEndDate: input.eventEndDate ? new Date(input.eventEndDate) : null,
          time: input.time ?? null,
          place: input.place ?? null,
          details: input.details ?? null,
          subtotal,
          discount: input.discount,
          discountName: input.discountName ?? null,
          totalPrice,
          bookingFee: input.bookingFee ?? null,
          termAndCondition: input.termAndCondition ?? null,
          paymentNote: input.paymentNote ?? null,
          cancellationPolicy: input.cancellationPolicy ?? null,
          closingNote: input.closingNote ?? null,
          validUntil: input.validUntil ? new Date(input.validUntil) : null,
          notes: input.notes ?? null,
          signingLocation: input.signingLocation ?? null,
          signatureSales: input.signatureSales ?? null,
        },
      }),
      // 2. Create items (regular)
      ...input.items.map((item, idx) =>
        db.quotationItem.create({
          data: {
            id: crypto.randomUUID(),
            quotationId,
            type: "ITEM",
            title: item.title,
            description: item.description ?? null,
            qty: item.qty,
            price: item.price,
            total: item.total,
            manualTotal: item.manualTotal,
            sortOrder: idx,
          },
        }),
      ),
      // 2a. Create additionals
      ...input.additionals.map((item, idx) =>
        db.quotationItem.create({
          data: {
            id: crypto.randomUUID(),
            quotationId,
            type: "ADDITIONAL",
            title: item.title,
            description: item.description ?? null,
            qty: item.qty,
            price: item.price,
            total: item.total,
            manualTotal: item.manualTotal,
            sortOrder: idx,
          },
        }),
      ),
      // 2a2. Create prices (Harga)
      ...input.prices.map((p, idx) =>
        db.quotationPrice.create({
          data: {
            id: crypto.randomUUID(),
            quotationId,
            name: p.name,
            description: p.description ?? null,
            priceType: p.priceType,
            qty: p.qty ?? null,
            price: p.price ?? null,
            total: p.total,
            sortOrder: idx,
          },
        }),
      ),
      // 2a3. Create tax & deposit
      ...input.taxDeposits.map((t, idx) =>
        db.quotationTaxDeposit.create({
          data: {
            id: crypto.randomUUID(),
            quotationId,
            name: t.name,
            nominal: t.nominal,
            sortOrder: idx,
          },
        }),
      ),
      // 2a4. Create terms (TOP)
      ...input.terms.map((t, idx) =>
        db.quotationTerm.create({
          data: {
            id: crypto.randomUUID(),
            quotationId,
            name: t.name,
            amount: t.amount,
            dueDate: t.dueDate ? new Date(t.dueDate) : null,
            sortOrder: idx,
          },
        }),
      ),
      // 2b. Create complimentaries
      ...input.complimentaries.map((c, idx) =>
        db.quotationComplimentary.create({
          data: {
            id: crypto.randomUUID(),
            quotationId,
            complimentaryId: c.complimentaryId ?? null,
            name: c.name,
            price: c.price,
            isShowPrice: c.isShowPrice,
            description: c.description ?? null,
            qty: c.qty,
            sortOrder: idx,
          },
        }),
      ),
      // 2c. Create bonuses
      ...input.bonuses.map((b, idx) =>
        db.quotationBonus.create({
          data: {
            id: crypto.randomUUID(),
            quotationId,
            bonusId: b.bonusId ?? null,
            name: b.name,
            price: b.price,
            description: b.description ?? null,
            qty: b.qty,
            sortOrder: idx,
          },
        }),
      ),
    ];

    // 2d. Freeze the selected package into snapshot tables
    if (input.packageId) {
      const snapOps = await buildPackageSnapshotOps(
        quotationId,
        input.packageId,
        input.packageName ?? "",
        input.pax,
      );
      ops.push(...snapOps);
    }

    // 3. Create approval record + steps.
    const approvalRecordId = crypto.randomUUID();
    const creatorRoleId = session!.user.roleId;
    const creatorStepIdx = approvalSteps.findIndex(
      (step) => step.approverType === "role" && step.approverRoleId === creatorRoleId,
    );

    ops.push(
      db.approvalRecord.create({
        data: {
          id: approvalRecordId,
          module: "quotations",
          entityId: quotationId,
          status: "pending",
          createdById: session!.user.profileId!,
        },
      }),
      ...approvalSteps.map((step, index) => {
        const shouldAutoApprove = creatorStepIdx >= 0 && index === creatorStepIdx;
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
            signature: null,
          },
        });
      }),
      db.activityLog.create({
        data: {
          userId: session!.user.profileId!,
          action: "quotation.created",
          entityType: "quotation",
          entityId: quotationId,
          description: `Quotation ${quotationNo} dibuat untuk ${input.clientName}`,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      }),
    );

    await db.$transaction(ops);

    revalidateTag("quotations", "max");

    return { success: true, data: { id: quotationId, quotationNo } };
  } catch (err) {
    console.error("[quotation.create]", err);
    return { success: false, error: "Gagal menyimpan quotation. Coba lagi." };
  }
}

// ── Update ─────────────────────────────────────────────────────────────────────

export async function updateQuotation(
  data: unknown,
): Promise<{ success: true; data: { id: string } } | { success: false; error: string }> {
  const { session, error } = await requirePermission({ module: "quotations", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`quotation-update:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = updateQuotationSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const input = parsed.data as UpdateQuotationInput & { id: string };
  const meta = await getRequestMeta();

  try {
    const [existing, approvalRecord] = await Promise.all([
      db.quotation.findUnique({
        where: { id: input.id },
        select: { id: true, booking: { select: { id: true } } },
      }),
      db.approvalRecord.findUnique({
        where: { module_entityId: { module: "quotations", entityId: input.id } },
        select: { id: true, status: true },
      }),
    ]);
    if (!existing) return { success: false, error: "Quotation tidak ditemukan." };
    if (approvalRecord?.status === "approved") {
      return { success: false, error: "Quotation yang sudah approved tidak dapat diedit. Buat revisi baru." };
    }
    if (existing.booking) {
      return { success: false, error: "Quotation yang sudah dikonversi tidak dapat diedit." };
    }

    const bankDetails = await resolveFrozenBankDetails(input.paymentMethodId);

    const pricingUpdate =
      input.items !== undefined
        ? (() => {
            const discount = input.discount ?? 0;
            const { subtotal, totalPrice } = computePricing(input.items, input.additionals ?? [], input.prices ?? [], discount);
            return { subtotal, discount, totalPrice };
          })()
        : undefined;

    const items = input.items ?? [];

    const ops: Prisma.PrismaPromise<unknown>[] = [
      // 1. Update quotation
      db.quotation.update({
        where: { id: input.id },
        data: {
          ...(input.status !== undefined && { status: input.status }),
          ...(input.clientName !== undefined && { clientName: input.clientName }),
          ...(input.clientPhone !== undefined && { clientPhone: input.clientPhone ?? "" }),
          instansi: input.instansi ?? null,
          ...(input.salesId !== undefined && { salesId: input.salesId }),
          ...(input.venueId !== undefined && { venueId: input.venueId }),
          ...(input.paymentMethodId !== undefined && {
            paymentMethodId: input.paymentMethodId,
            bankName: bankDetails.bankName,
            bankAccountNumber: bankDetails.bankAccountNumber,
            bankRecipient: bankDetails.bankRecipient,
          }),
          venueName: input.venueName ?? null,
          eventTypeId: input.eventTypeId ?? null,
          eventTypeName: input.eventTypeName ?? null,
          ...(input.packageId !== undefined && { packageId: input.packageId ?? null }),
          ...(input.packageName !== undefined && { packageName: input.packageName ?? null }),
          ...(input.pax !== undefined && { pax: input.pax }),
          ...(input.packageSource !== undefined && { packageSource: input.packageSource ?? null }),
          eventDate: input.eventDate ? new Date(input.eventDate) : null,
          eventEndDate: input.eventEndDate ? new Date(input.eventEndDate) : null,
          time: input.time ?? null,
          place: input.place ?? null,
          details: input.details ?? null,
          ...(pricingUpdate !== undefined && {
            subtotal: pricingUpdate.subtotal,
            discount: pricingUpdate.discount,
            totalPrice: pricingUpdate.totalPrice,
          }),
          bookingFee: input.bookingFee ?? null,
          discountName: input.discountName ?? null,
          termAndCondition: input.termAndCondition ?? null,
          paymentNote: input.paymentNote ?? null,
          cancellationPolicy: input.cancellationPolicy ?? null,
          closingNote: input.closingNote ?? null,
          validUntil: input.validUntil ? new Date(input.validUntil) : undefined,
          notes: input.notes ?? null,
          signingLocation: input.signingLocation ?? null,
          signatureSales: input.signatureSales ?? null,
        },
      }),
      // 2. Replace items + additionals (both in quotation_items, type distinguishes them)
      ...(input.items !== undefined || input.additionals !== undefined
        ? [
            db.quotationItem.deleteMany({ where: { quotationId: input.id } }),
            ...items.map((item, idx) =>
              db.quotationItem.create({
                data: {
                  id: crypto.randomUUID(),
                  quotationId: input.id,
                  type: "ITEM",
                  title: item.title,
                  description: item.description ?? null,
                  qty: item.qty,
                  price: item.price,
                  total: item.total,
                  manualTotal: item.manualTotal,
                  sortOrder: idx,
                },
              }),
            ),
            ...(input.additionals ?? []).map((item, idx) =>
              db.quotationItem.create({
                data: {
                  id: crypto.randomUUID(),
                  quotationId: input.id,
                  type: "ADDITIONAL",
                  title: item.title,
                  description: item.description ?? null,
                  qty: item.qty,
                  price: item.price,
                  total: item.total,
                  manualTotal: item.manualTotal,
                  sortOrder: idx,
                },
              }),
            ),
          ]
        : []),
      // 2b. Replace prices — only when prices payload is present
      ...(input.prices !== undefined
        ? [
            db.quotationPrice.deleteMany({ where: { quotationId: input.id } }),
            ...(input.prices ?? []).map((p, idx) =>
              db.quotationPrice.create({
                data: {
                  id: crypto.randomUUID(),
                  quotationId: input.id,
                  name: p.name,
                  description: p.description ?? null,
                  priceType: p.priceType,
                  qty: p.qty ?? null,
                  price: p.price ?? null,
                  total: p.total,
                  sortOrder: idx,
                },
              }),
            ),
          ]
        : []),
      // 2c. Replace tax & deposit — only when taxDeposits payload is present
      ...(input.taxDeposits !== undefined
        ? [
            db.quotationTaxDeposit.deleteMany({ where: { quotationId: input.id } }),
            ...(input.taxDeposits ?? []).map((t, idx) =>
              db.quotationTaxDeposit.create({
                data: {
                  id: crypto.randomUUID(),
                  quotationId: input.id,
                  name: t.name,
                  nominal: t.nominal,
                  sortOrder: idx,
                },
              }),
            ),
          ]
        : []),
      // 2d. Replace terms (TOP) — only when terms payload is present
      ...(input.terms !== undefined
        ? [
            db.quotationTerm.deleteMany({ where: { quotationId: input.id } }),
            ...(input.terms ?? []).map((t, idx) =>
              db.quotationTerm.create({
                data: {
                  id: crypto.randomUUID(),
                  quotationId: input.id,
                  name: t.name,
                  amount: t.amount,
                  dueDate: t.dueDate ? new Date(t.dueDate) : null,
                  sortOrder: idx,
                },
              }),
            ),
          ]
        : []),
      // 3. Replace complimentaries — only when complimentaries payload is present
      ...(input.complimentaries !== undefined
        ? [
            db.quotationComplimentary.deleteMany({ where: { quotationId: input.id } }),
            ...(input.complimentaries ?? []).map((c, idx) =>
              db.quotationComplimentary.create({
                data: {
                  id: crypto.randomUUID(),
                  quotationId: input.id,
                  complimentaryId: c.complimentaryId ?? null,
                  name: c.name,
                  price: c.price,
                  isShowPrice: c.isShowPrice,
                  description: c.description ?? null,
                  qty: c.qty,
                  sortOrder: idx,
                },
              }),
            ),
          ]
        : []),
      // 4. Replace bonuses — only when bonuses payload is present
      ...(input.bonuses !== undefined
        ? [
            db.quotationBonus.deleteMany({ where: { quotationId: input.id } }),
            ...(input.bonuses ?? []).map((b, idx) =>
              db.quotationBonus.create({
                data: {
                  id: crypto.randomUUID(),
                  quotationId: input.id,
                  bonusId: b.bonusId ?? null,
                  name: b.name,
                  price: b.price,
                  description: b.description ?? null,
                  qty: b.qty,
                  sortOrder: idx,
                },
              }),
            ),
          ]
        : []),
    ];

    // 2e. Replace package snapshot when a package is (re)selected
    if (input.packageId !== undefined) {
      ops.push(db.snapQuotationPackage.deleteMany({ where: { quotationId: input.id } }));
      if (input.packageId) {
        const snapOps = await buildPackageSnapshotOps(
          input.id,
          input.packageId,
          input.packageName ?? "",
          input.pax ?? 0,
        );
        ops.push(...snapOps);
      }
    }

    if (approvalRecord) {
      ops.push(
        db.approvalRecord.update({
          where: { id: approvalRecord.id },
          data: { status: "pending" },
        }),
        db.approvalRecordStep.updateMany({
          where: { recordId: approvalRecord.id },
          data: {
            status: "pending",
            decidedById: null,
            decidedAt: null,
            signature: null,
            notes: null,
          },
        }),
      );
    }

    ops.push(
      db.activityLog.create({
        data: {
          userId: session!.user.profileId!,
          action: "quotation.updated",
          entityType: "quotation",
          entityId: input.id,
          description: `Quotation ${input.id} diperbarui; approval direset`,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      }),
    );

    await db.$transaction(ops);

    revalidateTag("quotations", "max");

    return { success: true, data: { id: input.id } };
  } catch (err) {
    console.error("[quotation.update]", err);
    return { success: false, error: "Gagal memperbarui quotation. Coba lagi." };
  }
}

// ── Revision ───────────────────────────────────────────────────────────────────

export async function duplicateQuotationAsRevision(
  id: string,
): Promise<{ success: true; data: { id: string; quotationNo: string } } | { success: false; error: string }> {
  const { session, error } = await requirePermission({ module: "quotations", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`quotation-revise:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }
  if (!id) return { success: false, error: "ID quotation wajib ada." };

  const meta = await getRequestMeta();

  try {
    const [source, sourceApproval, approvalSteps] = await Promise.all([
      db.quotation.findUnique({
        where: { id },
        include: {
          items: { orderBy: { sortOrder: "asc" } },
          prices: { orderBy: { sortOrder: "asc" } },
          taxDeposits: { orderBy: { sortOrder: "asc" } },
          terms: { orderBy: { sortOrder: "asc" } },
          complimentaries: { orderBy: { sortOrder: "asc" } },
          bonuses: { orderBy: { sortOrder: "asc" } },
          packageSnapshot: {
            include: {
              items: { orderBy: { sortOrder: "asc" } },
              prices: { orderBy: { sortOrder: "asc" } },
              taxDeposits: { orderBy: { sortOrder: "asc" } },
              complimentaries: { orderBy: { sortOrder: "asc" } },
              bonuses: { orderBy: { sortOrder: "asc" } },
            },
          },
        },
      }),
      db.approvalRecord.findUnique({
        where: { module_entityId: { module: "quotations", entityId: id } },
        select: { status: true },
      }),
      resolveApprovalSteps("quotations"),
    ]);

    if (!source) return { success: false, error: "Quotation tidak ditemukan." };
    if (sourceApproval?.status !== "approved") {
      return { success: false, error: "Hanya quotation approved yang dapat direvisi." };
    }
    if (!approvalSteps || approvalSteps.length === 0) {
      return { success: false, error: "Alur approval quotation belum dikonfigurasi." };
    }

    const quotationId = crypto.randomUUID();
    const quotationNo = await generateQuotationNo();
    const approvalRecordId = crypto.randomUUID();
    const creatorStepIndex = approvalSteps.findIndex(
      (step) => step.approverRoleId === session!.user.roleId,
    );

    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.quotation.create({
        data: {
          id: quotationId,
          quotationNo,
          status: "revised",
          clientName: source.clientName,
          clientPhone: source.clientPhone,
          instansi: source.instansi,
          salesId: source.salesId,
          venueId: source.venueId,
          eventTypeId: source.eventTypeId,
          paymentMethodId: source.paymentMethodId,
          // Carry the frozen values across verbatim: a revision must start from
          // exactly what the approved document showed, not from current master data.
          bankName: source.bankName,
          bankAccountNumber: source.bankAccountNumber,
          bankRecipient: source.bankRecipient,
          eventTypeName: source.eventTypeName,
          venueName: source.venueName,
          packageId: source.packageId,
          packageName: source.packageName,
          pax: source.pax,
          packageSource: source.packageSource,
          eventDate: source.eventDate,
          eventEndDate: source.eventEndDate,
          time: source.time,
          place: source.place,
          details: source.details,
          subtotal: source.subtotal,
          discount: source.discount,
          discountName: source.discountName,
          totalPrice: source.totalPrice,
          bookingFee: source.bookingFee,
          termAndCondition: source.termAndCondition,
          paymentNote: source.paymentNote,
          cancellationPolicy: source.cancellationPolicy,
          closingNote: source.closingNote,
          validUntil: source.validUntil,
          notes: source.notes,
          signingLocation: source.signingLocation,
          signatureSales: source.signatureSales,
        },
      }),
      ...source.items.map((item) => db.quotationItem.create({
        data: {
          quotationId,
          type: item.type,
          title: item.title,
          description: item.description,
          qty: item.qty,
          price: item.price,
          total: item.total,
          manualTotal: item.manualTotal,
          sortOrder: item.sortOrder,
        },
      })),
      ...source.prices.map((price) => db.quotationPrice.create({
        data: {
          quotationId,
          name: price.name,
          description: price.description,
          priceType: price.priceType,
          qty: price.qty,
          price: price.price,
          total: price.total,
          sortOrder: price.sortOrder,
        },
      })),
      ...source.taxDeposits.map((taxDeposit) => db.quotationTaxDeposit.create({
        data: {
          quotationId,
          name: taxDeposit.name,
          nominal: taxDeposit.nominal,
          sortOrder: taxDeposit.sortOrder,
        },
      })),
      ...source.terms.map((term) => db.quotationTerm.create({
        data: {
          quotationId,
          name: term.name,
          amount: term.amount,
          dueDate: term.dueDate,
          sortOrder: term.sortOrder,
        },
      })),
      ...source.complimentaries.map((complimentary) => db.quotationComplimentary.create({
        data: {
          quotationId,
          complimentaryId: complimentary.complimentaryId,
          name: complimentary.name,
          price: complimentary.price,
          isShowPrice: complimentary.isShowPrice,
          description: complimentary.description,
          qty: complimentary.qty,
          sortOrder: complimentary.sortOrder,
        },
      })),
      ...source.bonuses.map((bonus) => db.quotationBonus.create({
        data: {
          quotationId,
          bonusId: bonus.bonusId,
          name: bonus.name,
          price: bonus.price,
          description: bonus.description,
          qty: bonus.qty,
          sortOrder: bonus.sortOrder,
        },
      })),
    ];

    if (source.packageSnapshot) {
      const snapshotId = crypto.randomUUID();
      const snapshot = source.packageSnapshot;
      ops.push(
        db.snapQuotationPackage.create({
          data: {
            id: snapshotId,
            quotationId,
            packageId: snapshot.packageId,
            packageName: snapshot.packageName,
            pax: snapshot.pax,
            venueId: snapshot.venueId,
            venueName: snapshot.venueName,
            eventTypeId: snapshot.eventTypeId,
            eventTypeName: snapshot.eventTypeName,
            paymentMethodId: snapshot.paymentMethodId,
          },
        }),
        ...snapshot.items.map((item) => db.snapQuotationPackageItem.create({
          data: { snapPackageId: snapshotId, itemName: item.itemName, itemDescription: item.itemDescription, sortOrder: item.sortOrder },
        })),
        ...snapshot.prices.map((price) => db.snapQuotationPackagePrice.create({
          data: { snapPackageId: snapshotId, name: price.name, description: price.description, priceType: price.priceType, qty: price.qty, price: price.price, total: price.total, sortOrder: price.sortOrder },
        })),
        ...snapshot.taxDeposits.map((taxDeposit) => db.snapQuotationPackageTaxDeposit.create({
          data: { snapPackageId: snapshotId, name: taxDeposit.name, nominal: taxDeposit.nominal, sortOrder: taxDeposit.sortOrder },
        })),
        ...snapshot.complimentaries.map((complimentary) => db.snapQuotationPackageComplimentary.create({
          data: { snapPackageId: snapshotId, complimentaryId: complimentary.complimentaryId, name: complimentary.name, price: complimentary.price, isShowPrice: complimentary.isShowPrice, description: complimentary.description, qty: complimentary.qty, sortOrder: complimentary.sortOrder },
        })),
        ...snapshot.bonuses.map((bonus) => db.snapQuotationPackageBonus.create({
          data: { snapPackageId: snapshotId, bonusId: bonus.bonusId, name: bonus.name, price: bonus.price, description: bonus.description, qty: bonus.qty, sortOrder: bonus.sortOrder },
        })),
      );
    }

    ops.push(
      db.approvalRecord.create({
        data: {
          id: approvalRecordId,
          module: "quotations",
          entityId: quotationId,
          status: "pending",
          createdById: session!.user.profileId!,
        },
      }),
      ...approvalSteps.map((step, index) => {
        const autoApprove = creatorStepIndex >= 0 && index === creatorStepIndex;
        return db.approvalRecordStep.create({
          data: {
            recordId: approvalRecordId,
            stepOrder: step.sortOrder,
            approverType: step.approverType,
            approverRoleId: step.approverRoleId,
            status: autoApprove ? "approved" : "pending",
            decidedById: autoApprove ? session!.user.profileId! : null,
            decidedAt: autoApprove ? new Date() : null,
          },
        });
      }),
      db.activityLog.create({
        data: {
          userId: session!.user.profileId!,
          action: "quotation.revised",
          entityType: "quotation",
          entityId: quotationId,
          description: `Revisi ${quotationNo} dibuat dari ${source.quotationNo ?? source.id}`,
          changes: { sourceQuotationId: source.id },
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      }),
    );

    await db.$transaction(ops);
    revalidateTag("quotations", "max");
    return { success: true, data: { id: quotationId, quotationNo } };
  } catch (err) {
    console.error("[quotation.revise]", err);
    return { success: false, error: "Gagal membuat revisi quotation." };
  }
}

// ── Convert to Booking MICE ────────────────────────────────────────────────────

export async function convertQuotationToMiceBooking(
  id: string,
): Promise<{ success: true; data: { id: string } } | { success: false; error: string }> {
  const { session, error } = await requirePermission({ module: "booking-mice", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`quotation-convert:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }
  if (!id) return { success: false, error: "ID quotation wajib ada." };

  const meta = await getRequestMeta();

  try {
    const [quotation, approvalRecord] = await Promise.all([
      db.quotation.findUnique({
        where: { id },
        include: {
          booking: { select: { id: true } },
          terms: { orderBy: { sortOrder: "asc" } },
          items: { orderBy: { sortOrder: "asc" } },
          complimentaries: { orderBy: { sortOrder: "asc" } },
          bonuses: { orderBy: { sortOrder: "asc" } },
        },
      }),
      db.approvalRecord.findUnique({
        where: { module_entityId: { module: "quotations", entityId: id } },
        select: { status: true },
      }),
    ]);

    if (!quotation) return { success: false, error: "Quotation tidak ditemukan." };
    if (approvalRecord?.status !== "approved") {
      return { success: false, error: "Quotation harus fully approved sebelum dikonversi." };
    }
    if (quotation.booking) {
      return { success: false, error: "Quotation ini sudah dikonversi menjadi booking." };
    }
    if (!quotation.venueId || !quotation.eventTypeId || !quotation.eventDate) {
      return { success: false, error: "Venue, tipe event, dan tanggal event wajib lengkap sebelum konversi." };
    }
    if (quotation.terms.length === 0 || quotation.terms.some((term) => !term.dueDate)) {
      return { success: false, error: "Minimal satu TOP dengan tanggal jatuh tempo wajib diisi sebelum konversi." };
    }

    // Master data is resolved explicitly here rather than through a relation:
    // Quotation intentionally holds FK-less pointers so an issued document never
    // changes when master data does. A booking, unlike a quotation, IS a live
    // record — it needs the real venue/eventType rows for its own FKs and PO number.
    const [managerId, livePackage, venue, eventType] = await Promise.all([
      resolveManagerId(quotation.salesId),
      quotation.packageId
        ? db.package.findUnique({ where: { id: quotation.packageId }, select: { id: true } })
        : Promise.resolve(null),
      db.venue.findUnique({
        where: { id: quotation.venueId },
        select: { id: true, name: true, code: true, address: true, description: true, brand: { select: { name: true, code: true } } },
      }),
      db.eventType.findUnique({ where: { id: quotation.eventTypeId }, select: { id: true, code: true } }),
    ]);
    if (!venue || !eventType) {
      return { success: false, error: "Venue atau tipe event pada quotation sudah tidak tersedia." };
    }
    const bookingApprovalSteps = await buildBookingApprovalSteps({
      module: "booking-mice",
      salesId: quotation.salesId,
      creatorProfileId: session!.user.profileId!,
      signatureSales: quotation.signatureSales,
      decidedAt: new Date(),
      includeClientStep: false,
    });
    if (!bookingApprovalSteps || bookingApprovalSteps.length === 0) {
      return { success: false, error: "Alur approval Booking MICE belum dikonfigurasi." };
    }

    // Sequence reservation is atomic on its own; all business writes below are
    // committed together in one array transaction (required by Neon HTTP).
    const now = new Date();
    const year = now.getFullYear();
    const poSeq = await getNextSequence(`po-${year}`);
    const dd = now.getDate().toString().padStart(2, "0");
    const mm = (now.getMonth() + 1).toString().padStart(2, "0");
    const poNumber = `${poSeq.toString().padStart(3, "0")}/${venue.brand?.code ?? ""}/${venue.code}/${eventType.code}/${dd}-${mm}-${year}`;
    const bookingId = crypto.randomUUID();
    const customerId = crypto.randomUUID();
    const bookingApprovalId = crypto.randomUUID();

    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.customer.create({
        data: {
          id: customerId,
          name: quotation.clientName,
          mobileNumber: [{ number: quotation.clientPhone }],
          type: "mice",
          memberStatus: "Non-Member",
          notes: quotation.instansi ? `Instansi: ${quotation.instansi}` : null,
          updatedBy: session!.user.name ?? session!.user.email ?? null,
        },
      }),
      db.booking.create({
        data: {
          id: bookingId,
          category: "MICE",
          recordStatus: "saved",
          bookingStatus: "Pending",
          eventDate: quotation.eventDate,
          eventTime: quotation.time,
          notes: quotation.notes,
          dealingDate: now,
          quotationId: quotation.id,
          salesId: quotation.salesId,
          managerId,
          customerId,
          venueId: quotation.venueId,
          packageId: livePackage?.id ?? null,
          paymentMethodId: quotation.paymentMethodId,
          salesSignature: quotation.signatureSales,
          signingLocation: quotation.signingLocation,
          discountName: quotation.discountName,
          discountAmount: quotation.discount,
          poNumber,
          poYear: year,
          poSeq,
        },
      }),
      db.snapCustomer.create({
        data: {
          bookingId,
          customerId,
          name: quotation.clientName,
          mobileNumber: quotation.clientPhone,
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
      ...quotation.items.map((item) => db.snapPackageInternalItem.create({
        data: {
          bookingId,
          itemName: item.title,
          itemDescription: item.description ?? "",
          sortOrder: item.sortOrder,
        },
      })),
      ...quotation.complimentaries.map((complimentary) => db.snapComplimentary.create({
        data: {
          bookingId,
          complimentaryId: complimentary.complimentaryId,
          name: complimentary.name,
          price: complimentary.price,
          isShowPrice: complimentary.isShowPrice,
          description: complimentary.description,
          qty: complimentary.qty,
          sortOrder: complimentary.sortOrder,
        },
      })),
      ...quotation.bonuses.map((bonus) => db.snapBookingBonus.create({
        data: {
          bookingId,
          bonusId: bonus.bonusId,
          name: bonus.name,
          price: bonus.price,
          description: bonus.description,
          qty: bonus.qty,
          sortOrder: bonus.sortOrder,
        },
      })),
      ...quotation.terms.map((term) => db.termOfPayment.create({
        data: {
          bookingId,
          name: term.name,
          amount: term.amount,
          dueDate: term.dueDate!,
          sortOrder: term.sortOrder,
        },
      })),
      db.approvalRecord.create({
        data: {
          id: bookingApprovalId,
          module: "booking-mice",
          entityId: bookingId,
          status: "pending",
          createdById: session!.user.profileId!,
        },
      }),
      ...bookingApprovalSteps.map((step) => db.approvalRecordStep.create({
        data: {
          recordId: bookingApprovalId,
          stepOrder: step.stepOrder,
          approverType: step.approverType,
          approverRoleId: step.approverRoleId,
          approverUserId: step.approverUserId,
          status: step.status,
          decidedById: step.decidedById,
          decidedAt: step.decidedAt,
          signature: step.signature,
        },
      })),
      db.clientAgreement.create({
        data: {
          bookingId,
          token: crypto.randomUUID(),
          accessCode: generateAccessCode(),
        },
      }),
      db.activityLog.create({
        data: {
          userId: session!.user.profileId!,
          action: "quotation.converted_to_booking_mice",
          entityType: "quotation",
          entityId: quotation.id,
          description: `${quotation.quotationNo ?? quotation.id} dikonversi ke booking ${poNumber}`,
          changes: { bookingId },
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      }),
    ];

    if (livePackage && quotation.packageName) {
      ops.push(
        db.snapPackage.create({
          data: {
            bookingId,
            packageId: livePackage.id,
            packageName: quotation.packageName,
            notes: quotation.details,
          },
        }),
        db.snapPackagePricing.create({
          data: {
            bookingId,
            packageId: livePackage.id,
            packageName: quotation.packageName,
            pax: quotation.pax,
            price: quotation.totalPrice,
            fullPrice: quotation.subtotal,
            termAndCondition: quotation.termAndCondition,
          },
        }),
      );
    }

    await db.$transaction(ops);
    revalidateTag("quotations", "max");
    revalidateTag("bookings", "max");
    revalidateTag("customers", "max");
    return { success: true, data: { id: bookingId } };
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
    if (code === "P2002" || code === "23505") {
      return { success: false, error: "Quotation ini sudah dikonversi menjadi booking." };
    }
    console.error("[quotation.convert]", err);
    return { success: false, error: "Gagal mengonversi quotation menjadi Booking MICE." };
  }
}

// ── Delete ─────────────────────────────────────────────────────────────────────

export async function deleteQuotation(
  id: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const { session, error } = await requirePermission({ module: "quotations", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`quotation-delete:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  if (!id) return { success: false, error: "ID quotation wajib ada." };
  const meta = await getRequestMeta();

  try {
    const [existing, approvalRecord] = await Promise.all([
      db.quotation.findUnique({
        where: { id },
        select: { id: true, quotationNo: true, booking: { select: { id: true } } },
      }),
      db.approvalRecord.findUnique({
        where: { module_entityId: { module: "quotations", entityId: id } },
        select: { status: true },
      }),
    ]);
    if (!existing) return { success: false, error: "Quotation tidak ditemukan." };
    if (approvalRecord?.status === "approved") {
      return { success: false, error: "Quotation yang sudah approved tidak dapat dihapus." };
    }
    if (existing.booking) {
      return { success: false, error: "Quotation yang sudah dikonversi tidak dapat dihapus." };
    }

    await db.$transaction([
      db.quotation.delete({ where: { id } }),
      db.activityLog.create({
        data: {
          userId: session!.user.profileId!,
          action: "quotation.deleted",
          entityType: "quotation",
          entityId: id,
          description: `Quotation ${existing.quotationNo ?? id} dihapus`,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      }),
    ]);

    revalidateTag("quotations", "max");

    return { success: true };
  } catch (err) {
    console.error("[quotation.delete]", err);
    return { success: false, error: "Gagal menghapus quotation. Coba lagi." };
  }
}
