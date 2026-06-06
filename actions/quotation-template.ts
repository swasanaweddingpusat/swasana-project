"use server";

import { revalidateTag } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { upsertQuotationTemplateSchema } from "@/lib/validations/quotation-template";

/**
 * Create or update the quotation template for a venue (one template per venue).
 * Items are fully replaced (delete all + re-create) inside one transaction.
 */
export async function upsertQuotationTemplate(data: unknown) {
  const { session, error } = await requirePermission({ module: "settings-quotation-templates", action: "create" });
  if (error) return { success: false as const, error };
  if (!mutationLimiter.check(`qt-tpl-upsert:${session!.user.id}`)) return { success: false as const, ...rateLimitError() };

  const parsed = upsertQuotationTemplateSchema.safeParse(data);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0].message };

  const input = parsed.data;

  try {
    const existing = await db.quotationTemplate.findUnique({
      where: { venueId: input.venueId },
      select: { id: true },
    });

    const templateId = existing?.id ?? crypto.randomUUID();
    const ops: Prisma.PrismaPromise<unknown>[] = [];

    if (existing) {
      ops.push(
        db.quotationTemplate.update({
          where: { id: templateId },
          data: { paymentMethodId: input.paymentMethodId ?? null },
        }),
        db.quotationTemplateItem.deleteMany({ where: { templateId } }),
      );
    } else {
      ops.push(
        db.quotationTemplate.create({
          data: {
            id: templateId,
            venueId: input.venueId,
            paymentMethodId: input.paymentMethodId ?? null,
          },
        }),
      );
    }

    ops.push(
      ...input.items.map((item, idx) =>
        db.quotationTemplateItem.create({
          data: {
            id: crypto.randomUUID(),
            templateId,
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
    );

    await db.$transaction(ops);
    revalidateTag("quotation-templates", "max");
    return { success: true as const, data: { id: templateId } };
  } catch (e) {
    console.error("[upsertQuotationTemplate]", e);
    return { success: false as const, error: "Terjadi kesalahan." };
  }
}

export async function deleteQuotationTemplate(id: string) {
  const { session, error } = await requirePermission({ module: "settings-quotation-templates", action: "delete" });
  if (error) return { success: false as const, error };
  if (!mutationLimiter.check(`qt-tpl-delete:${session!.user.id}`)) return { success: false as const, ...rateLimitError() };

  try {
    await db.$transaction([db.quotationTemplate.delete({ where: { id } })]);
    revalidateTag("quotation-templates", "max");
    return { success: true as const };
  } catch (e) {
    console.error("[deleteQuotationTemplate]", e);
    return { success: false as const, error: "Terjadi kesalahan." };
  }
}
