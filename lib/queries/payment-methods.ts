import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

/**
 * Rekening tujuan buat picker di entry drawer cashbook. Pola persis promo.ts —
 * "use cache" + cacheTag + cacheLife("minutes"), TANPA requirePermission (data
 * referensi, bukan sensitif). PaymentMethod tidak punya flag isActive di schema,
 * jadi ambil semua (hard cap 100).
 */
export async function getPaymentMethodsForPicker() {
  "use cache";
  cacheTag("payment-methods");
  cacheLife("minutes");
  return db.paymentMethod.findMany({
    select: { id: true, bankName: true, bankAccountNumber: true },
    orderBy: { bankName: "asc" },
    take: 100,
  });
}

export type PaymentMethodPickerItem = {
  id: string;
  /** bankName + 3 digit akhir rekening, e.g. "BCA 149". */
  label: string;
};

export type PaymentMethodsResult = Awaited<ReturnType<typeof getPaymentMethodsForPicker>>;

/** Map raw rows → picker items dengan label "BankName 149" (3 digit akhir). */
export function toPaymentMethodPickerItems(
  rows: PaymentMethodsResult,
): PaymentMethodPickerItem[] {
  return rows.map((r) => ({
    id: r.id,
    label: `${r.bankName} ${r.bankAccountNumber.slice(-3)}`,
  }));
}
