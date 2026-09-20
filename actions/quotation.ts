"use server";

import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { getNextSequence } from "@/lib/counter";
import { resolveApprovalSteps } from "@/lib/approval-flows";
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
  discount: number,
): {
  subtotal: number;
  totalPrice: number;
} {
  const itemsTotal = items.reduce((sum, item) => sum + item.total, 0);
  const additionalsTotal = additionals.reduce((sum, item) => sum + item.total, 0);
  const subtotal = itemsTotal + additionalsTotal;
  const totalPrice = Math.max(0, subtotal - discount);
  return { subtotal, totalPrice };
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
    const { subtotal, totalPrice } = computePricing(input.items, input.additionals, input.discount);

    // Resolve approval steps for quotations (Manager + Finance).
    // If any role is missing in DB, approvalSteps will be null — we skip approval
    // record creation silently (quotation is still saved; approval can be added later).
    const approvalSteps = await resolveApprovalSteps("quotations");

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
          venueName: input.venueName ?? null,
          eventTypeId: input.eventTypeId ?? null,
          eventTypeName: input.eventTypeName ?? null,
          packageId: input.packageId ?? null,
          packageName: input.packageName ?? null,
          pax: input.pax,
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

    // 3. Create approval record + steps (if flow is resolved)
    if (approvalSteps && approvalSteps.length > 0) {
      const approvalRecordId = crypto.randomUUID();
      const creatorRoleId = session!.user.roleId;
      // Auto-approve the step whose approverRoleId matches the creator's role
      const creatorStepIdx = approvalSteps.findIndex(
        (s) => s.approverType === "role" && s.approverRoleId === creatorRoleId
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
        ...approvalSteps.map((step, i) => {
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
              signature: null,
            },
          });
        })
      );
    }

    await db.$transaction(ops);

    await logAudit({
      userId: session!.user.id,
      action: "quotation.created",
      entityType: "quotation",
      entityId: quotationId,
      description: `Quotation ${quotationNo} dibuat untuk ${input.clientName}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

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
    const existing = await db.quotation.findUnique({ where: { id: input.id }, select: { id: true } });
    if (!existing) return { success: false, error: "Quotation tidak ditemukan." };

    const pricingUpdate =
      input.items !== undefined
        ? (() => {
            const discount = input.discount ?? 0;
            const { subtotal, totalPrice } = computePricing(input.items, input.additionals ?? [], discount);
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
          ...(input.paymentMethodId !== undefined && { paymentMethodId: input.paymentMethodId }),
          venueName: input.venueName ?? null,
          eventTypeId: input.eventTypeId ?? null,
          eventTypeName: input.eventTypeName ?? null,
          ...(input.packageId !== undefined && { packageId: input.packageId ?? null }),
          ...(input.packageName !== undefined && { packageName: input.packageName ?? null }),
          ...(input.pax !== undefined && { pax: input.pax }),
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

    await db.$transaction(ops);

    await logAudit({
      userId: session!.user.id,
      action: "quotation.updated",
      entityType: "quotation",
      entityId: input.id,
      description: `Quotation ${input.id} diperbarui`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    revalidateTag("quotations", "max");

    return { success: true, data: { id: input.id } };
  } catch (err) {
    console.error("[quotation.update]", err);
    return { success: false, error: "Gagal memperbarui quotation. Coba lagi." };
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
    const existing = await db.quotation.findUnique({ where: { id }, select: { id: true, quotationNo: true } });
    if (!existing) return { success: false, error: "Quotation tidak ditemukan." };

    // Cascade delete via FK (items & terms) — single-table delete
    await db.$transaction([db.quotation.delete({ where: { id } })]);

    await logAudit({
      userId: session!.user.id,
      action: "quotation.deleted",
      entityType: "quotation",
      entityId: id,
      description: `Quotation ${existing.quotationNo ?? id} dihapus`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    revalidateTag("quotations", "max");

    return { success: true };
  } catch (err) {
    console.error("[quotation.delete]", err);
    return { success: false, error: "Gagal menghapus quotation. Coba lagi." };
  }
}
