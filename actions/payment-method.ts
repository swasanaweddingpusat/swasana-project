"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { z } from "zod";

const schema = z.object({
  venueId: z.string().optional().nullable(),
  bankName: z.string().min(1, "Nama bank wajib diisi"),
  bankAccountNumber: z.string().min(1, "No. rekening wajib diisi").max(16, "No. rekening maksimal 16 digit").regex(/^\d+$/, "No. rekening hanya boleh angka"),
  bankRecipient: z.string().min(1, "Nama pemilik wajib diisi"),
});

export async function createPaymentMethod(data: unknown) {
  const { session, error } = await requirePermission({ module: "settings-payment-methods", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`pm-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = schema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [pm] = await db.$transaction([db.paymentMethod.create({ data: parsed.data })]);
    revalidateTag("payment-methods", "max");
    return { success: true, data: pm };
  } catch (e) {
    console.error("[createPaymentMethod]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function updatePaymentMethod(id: string, data: unknown) {
  const { session, error } = await requirePermission({ module: "settings-payment-methods", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`pm-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = schema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [pm] = await db.$transaction([db.paymentMethod.update({ where: { id }, data: parsed.data })]);
    revalidateTag("payment-methods", "max");
    return { success: true, data: pm };
  } catch (e) {
    console.error("[updatePaymentMethod]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deletePaymentMethod(id: string) {
  const { session, error } = await requirePermission({ module: "settings-payment-methods", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`pm-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.$transaction([db.paymentMethod.delete({ where: { id } })]);
    revalidateTag("payment-methods", "max");
    return { success: true };
  } catch (e) {
    console.error("[deletePaymentMethod]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
