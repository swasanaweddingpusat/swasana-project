"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { z } from "zod";

const schema = z.object({
  venueId: z.string().min(1),
  bankName: z.string().min(1, "Nama bank wajib diisi"),
  bankAccountNumber: z.string().min(1, "No. rekening wajib diisi"),
  bankRecipient: z.string().min(1, "Nama pemilik wajib diisi"),
});

export async function createPaymentMethod(data: unknown) {
  const permResult = await requirePermission({ module: "payment_methods", action: "create" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`pm-create:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = schema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const pm = await db.paymentMethod.create({ data: parsed.data });
  return { success: true, data: pm };
}

export async function updatePaymentMethod(id: string, data: unknown) {
  const permResult = await requirePermission({ module: "payment_methods", action: "edit" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`pm-update:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = schema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const pm = await db.paymentMethod.update({ where: { id }, data: parsed.data });
  return { success: true, data: pm };
}

export async function deletePaymentMethod(id: string) {
  const permResult = await requirePermission({ module: "payment_methods", action: "delete" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`pm-delete:${session.user.id}`)) return { success: false, ...rateLimitError() };

  await db.paymentMethod.delete({ where: { id } });
  return { success: true };
}
