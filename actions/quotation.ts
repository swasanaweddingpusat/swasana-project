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

function computePricing(items: CreateQuotationInput["items"], discount: number): {
  subtotal: number;
  totalPrice: number;
} {
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const totalPrice = Math.max(0, subtotal - discount);
  return { subtotal, totalPrice };
}

async function generateQuotationNo(category: "WEDDINGS" | "MICE"): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`quotation-${year}`);
  const prefix = category === "MICE" ? "MICE" : "WED";
  return `${seq.toString().padStart(3, "0")}/${prefix}/${year}`;
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
    const quotationNo = await generateQuotationNo(input.category);
    const { subtotal, totalPrice } = computePricing(input.items, input.discount);

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
          category: input.category,
          status: "draft",
          clientName: input.clientName,
          clientPhone: input.clientPhone,
          instansi: input.instansi ?? null,
          salesId: input.salesId,
          venueId: input.venueId ?? null,
          venueName: input.venueName ?? null,
          eventTypeId: input.eventTypeId ?? null,
          eventTypeName: input.eventTypeName ?? null,
          weddingSession: input.weddingSession ?? null,
          eventDate: input.eventDate ? new Date(input.eventDate) : null,
          time: input.time ?? null,
          details: input.details ?? null,
          subtotal,
          discount: input.discount,
          totalPrice,
          validUntil: input.validUntil ? new Date(input.validUntil) : null,
          notes: input.notes ?? null,
          signingLocation: input.signingLocation ?? null,
          signatureSales: input.signatureSales ?? null,
        },
      }),
      // 2. Create items
      ...input.items.map((item, idx) =>
        db.quotationItem.create({
          data: {
            id: crypto.randomUUID(),
            quotationId,
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
      // 3. Create terms
      ...input.termOfPayments.map((term, idx) =>
        db.quotationTerm.create({
          data: {
            id: crypto.randomUUID(),
            quotationId,
            name: term.name,
            amount: term.amount,
            dueDate: term.dueDate ? new Date(term.dueDate) : null,
            sortOrder: idx,
            paymentStatus: term.paymentStatus,
          },
        }),
      ),
    ];

    // 4. Create approval record + steps (if flow is resolved)
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

    const items = input.items ?? [];
    const terms = input.termOfPayments ?? [];
    const discount = input.discount ?? 0;
    const { subtotal, totalPrice } = computePricing(items, discount);

    const ops: Prisma.PrismaPromise<unknown>[] = [
      // 1. Update quotation
      db.quotation.update({
        where: { id: input.id },
        data: {
          ...(input.category !== undefined && { category: input.category }),
          ...(input.status !== undefined && { status: input.status }),
          ...(input.clientName !== undefined && { clientName: input.clientName }),
          ...(input.clientPhone !== undefined && { clientPhone: input.clientPhone }),
          instansi: input.instansi ?? null,
          ...(input.salesId !== undefined && { salesId: input.salesId }),
          ...(input.venueId !== undefined && { venueId: input.venueId }),
          venueName: input.venueName ?? null,
          eventTypeId: input.eventTypeId ?? null,
          eventTypeName: input.eventTypeName ?? null,
          weddingSession: input.weddingSession ?? null,
          eventDate: input.eventDate ? new Date(input.eventDate) : null,
          time: input.time ?? null,
          details: input.details ?? null,
          subtotal,
          discount,
          totalPrice,
          validUntil: input.validUntil ? new Date(input.validUntil) : undefined,
          notes: input.notes ?? null,
          signingLocation: input.signingLocation ?? null,
          signatureSales: input.signatureSales ?? null,
        },
      }),
      // 2. Replace items — delete all then re-create
      db.quotationItem.deleteMany({ where: { quotationId: input.id } }),
      // 3. Replace terms — delete all then re-create
      db.quotationTerm.deleteMany({ where: { quotationId: input.id } }),
      // 4. Re-create items
      ...items.map((item, idx) =>
        db.quotationItem.create({
          data: {
            id: crypto.randomUUID(),
            quotationId: input.id,
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
      // 5. Re-create terms
      ...terms.map((term, idx) =>
        db.quotationTerm.create({
          data: {
            id: crypto.randomUUID(),
            quotationId: input.id,
            name: term.name,
            amount: term.amount,
            dueDate: term.dueDate ? new Date(term.dueDate) : null,
            sortOrder: idx,
            paymentStatus: term.paymentStatus,
          },
        }),
      ),
    ];

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
