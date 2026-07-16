"use client";

import { useQuery } from "@tanstack/react-query";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ActivePromoOption {
  id: string;
  name: string;
  discountType: "PERCENTAGE" | "NOMINAL";
  discountValue: number;
  /** Tanggal akhir masa berlaku program (ISO string) — null kalau tak ada. */
  periodEnd: string | null;
}

// ─── Helper ────────────────────────────────────────────────────────────────────

/**
 * Hitung potongan promo dari nominal GROSS.
 * PERCENTAGE → round(gross × rate / 100); NOMINAL → fixed value.
 * Di-cap supaya potongan tidak melebihi gross. Return 0 kalau promo null / gross ≤ 0.
 */
export function computePromoDiscount(
  gross: number,
  promo: { discountType: "PERCENTAGE" | "NOMINAL"; discountValue: number } | null,
): number {
  if (!promo || gross <= 0) return 0;
  const raw =
    promo.discountType === "PERCENTAGE"
      ? Math.round((gross * promo.discountValue) / 100)
      : promo.discountValue;
  return raw > gross ? gross : raw;
}

// ─── Fetcher ───────────────────────────────────────────────────────────────────

async function fetchActivePromos(): Promise<ActivePromoOption[]> {
  const res = await fetch("/api/promos?activeOnly=true");
  if (!res.ok) throw new Error("Gagal memuat data promo");

  const json: unknown = await res.json();
  if (
    typeof json !== "object" ||
    json === null ||
    !Array.isArray((json as Record<string, unknown>).items)
  ) {
    return [];
  }

  const items = (json as { items: unknown[] }).items;

  return items
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    // Hanya "payment_discount"; kalau field type tidak ada → treat as payment_discount (fallback)
    .filter((item) => item.type !== "cashback")
    .map((item) => ({
      id: String(item.id ?? ""),
      name: String(item.name ?? ""),
      discountType: item.discountType === "NOMINAL" ? ("NOMINAL" as const) : ("PERCENTAGE" as const),
      discountValue: typeof item.discountValue === "number" ? item.discountValue : 0,
      periodEnd: typeof item.periodEnd === "string" ? item.periodEnd : null,
    }))
    .filter((item) => item.id !== "");
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Fetch promo program aktif bertipe `payment_discount` (motong tagihan).
 * Cashback difilter — arahnya uang keluar, bukan potong tagihan.
 * staleTime 5 menit: daftar promo jarang berubah di sesi kerja.
 */
export function useActivePromos(): ActivePromoOption[] {
  // JANGAN pakai initialData: [] — React Query menganggapnya data fresh, jadi
  // fetcher tak pernah jalan selama staleTime. Biarkan status awal `pending`
  // supaya queryFn dieksekusi; default kosong via `data ?? []`.
  const { data } = useQuery<ActivePromoOption[]>({
    queryKey: ["active-promos"],
    queryFn: fetchActivePromos,
    staleTime: 5 * 60 * 1000,
  });
  return data ?? [];
}
