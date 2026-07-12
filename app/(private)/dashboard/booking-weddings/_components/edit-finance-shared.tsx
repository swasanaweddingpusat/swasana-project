"use client";

export function fmtRp(n: number): string {
  return n.toLocaleString("id-ID");
}

export function toLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}T00:00:00.000Z`;
}

// Fase 5: TOP = jadwal murni. "Terbayar" DERIVED dari Ledger cash-in (bukan kolom TOP).
export interface FinanceTerm {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  sortOrder: number;
  notes: string | null;
  /** Σ alokasi Ledger cash-in ter-ack. >0 = terkunci (tak bisa diedit/dihapus). */
  paid: number;
}

export interface FinanceCategoryRow {
  id: string;
  categoryName: string;
  basePrice: number;
  sortOrder: number;
  isShow: boolean;
  isTakeout: boolean;
  takeoutNominal: number;
}
