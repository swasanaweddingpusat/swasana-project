export interface FinanceStats {
  pendingBookingProcess: number;
  pendingPOApproval: number;
  lateInvoiceOverdue: number;
  bookingsNeedSignature: number;
}

export interface FinanceBooking {
  id: string;
  customerName: string;
  customerPhone: string;
  eventDate: string;
  bookingStatus: "Confirmed" | "Pending" | "New" | "Uploaded";
  paymentStatus: string;
  paymentMethod: string;
}

export interface ActivityItem {
  id: string;
  icon: "inquiry" | "meeting" | "confirmation";
  title: string;
  description: string;
}

export interface SalesLeader {
  id: string;
  name: string;
  totalSales: number;
}

export type FinanceTabType = "receivable" | "payable";

// ─── AR Types ────────────────────────────────────────────────────────────────

export type ARInvoiceStatus = "paid" | "partial" | "unpaid" | "unissued";
export type ARTerminStatus = "paid" | "partial" | "unpaid" | "overdue" | "not_due_yet";

export interface ARFilters {
  status?: ARTerminStatus;
  venue?: string;
  salesPic?: string;
  dateRange?: { from?: string; to?: string };
  search?: string;
}

export interface ARPartialPayment {
  id: string;
  amount: number;
  paidAt: string;
  notes: string | null;
}

export type ARTerminAckStatus = "pending" | "acknowledged" | "rejected";

export interface ARTermin {
  id: string;
  name: string;
  dueDate: string;
  amount: number;
  remaining: number;
  status: ARTerminStatus;
  noInvoice: string;
  statusInvoice: ARInvoiceStatus;
  agingDays: number | null;
  catatan: string;
  partialPayments: ARPartialPayment[];
  // Acknowledgment fields
  ackStatus: ARTerminAckStatus;
  acknowledgedAt: string | null;
  acknowledgedByName: string | null;
  /** Bank tujuan transfer, e.g. "BCA 149" (bankName + 3 digit akhir rekening). Null = belum di-set. */
  viaRekening: string | null;
}

export type ARBookingStatus = "Pending" | "Uploaded" | "Confirmed" | "Rejected" | "Canceled" | "Lost";

export interface ARBooking {
  id: string;
  noPo: string;
  bookingStatus: ARBookingStatus;
  customerEvent: string;
  customerEmail: string;
  customerPhone: string;
  customerDate: string;
  namaEvent: string;
  brandName: string | null;
  venueId: string;
  salesId: string;
  salesPicName: string;
  packageName: string | null;
  totalPrice: number;
  outstanding: number;
  jatuhTempo: string;
  statusTermin: ARTerminStatus;
  termins: ARTermin[];
}

// ─── AR Aging & Client (UI-derived, no new query) ────────────────────────────

/** Aging bucket keys — derived client-side from ARTermin.agingDays. */
export type AgingBucketKey = "not_due" | "d1_30" | "d31_60" | "d61_90" | "d90_plus";

/** One termin flattened into the aging report table. */
export interface AgingRow {
  bookingId: string;
  terminId: string;
  client: string;
  noPo: string;
  terminName: string;
  dueDate: string;
  outstanding: number;
  agingDays: number | null;
  bucket: AgingBucketKey;
  salesPicName: string;
  venueId: string;
  salesId: string;
}

/** Aggregated AR per customer for the Client page. */
export interface ARClientRow {
  client: string;
  bookingCount: number;
  totalKontrak: number;
  dibayar: number;
  sisa: number;
  bookings: {
    id: string;
    noPo: string;
    namaEvent: string;
    totalPrice: number;
    outstanding: number;
    statusTermin: ARTerminStatus;
  }[];
}

// ─── AP Types (Accounts Payable) ─────────────────────────────────────────────

/**
 * Categories of things the company must pay out.
 * - bonus-sales: sales commission/bonus once a booking lands
 * - fee-manager: fee for catering/vendor manager
 * - tunjangan-wp: wedding-planner allowance — only payable AFTER the event is done
 * - general-expense: operational expense not tied to a single event
 * - mice: payables originating from MICE bookings
 */
export type APCategory =
  | "bonus-sales"
  | "fee-manager"
  | "tunjangan-wp"
  | "general-expense"
  | "mice";

/** Payment progress of a single payable. */
export type APStatus = "unpaid" | "partial" | "paid" | "on_hold";

/** Acknowledgment of the recipient that money was received. */
export type APAckStatus = "pending" | "acknowledged" | "rejected";

export interface APPayment {
  id: string;
  amount: number;
  paidAt: string;
  method: string;
  notes: string | null;
}

export interface APPayable {
  id: string;
  category: APCategory;
  /** Who gets paid (sales name, vendor, planner, supplier, …). */
  payeeName: string;
  /** Short label, e.g. "Bonus closing — Wedding Andini". */
  title: string;
  /** Event this payable belongs to, null for pure general expense. */
  eventName: string | null;
  eventId: string | null;
  eventDate: string | null;
  /** True once the related event has finished — gates tunjangan-wp payout. */
  eventDone: boolean;
  amount: number;
  /** Already paid out (sum of payments). */
  paidAmount: number;
  /** amount - paidAmount. */
  outstanding: number;
  dueDate: string;
  status: APStatus;
  ackStatus: APAckStatus;
  acknowledgedAt: string | null;
  acknowledgedByName: string | null;
  notes: string | null;
  payments: APPayment[];
}

/** A grouping of payables under one event (for the Event view). */
export interface APEvent {
  id: string;
  eventName: string;
  eventDate: string;
  eventDone: boolean;
  totalPayable: number;
  totalOutstanding: number;
  payables: APPayable[];
}

export interface APFilters {
  category?: APCategory;
  status?: APStatus;
  ack?: APAckStatus;
  search?: string;
  dateRange?: { from?: string; to?: string };
}

// ─── Ledger Types (Buku Besar / Cashflow) ────────────────────────────────────

/**
 * Lifecycle status of one ledger row — the 3-phase money journey.
 * - receivable: client sudah teken kontrak, belum bayar (piutang)
 * - unearned:   uang sudah masuk, tapi acara belum jalan → belum jadi pendapatan (kredit/titipan)
 * - earned:     acara selesai + approval lengkap → pendapatan sah (debit)
 * - void:       dibatalkan (koreksi non-destruktif, append-only)
 */
export type LedgerStatus = "receivable" | "unearned" | "earned" | "void";

/**
 * What kind of movement a row records.
 * - receivable:  baris kontrak per termin (dibuat saat signing)
 * - cash_in:     uang riil masuk (pembayaran/cicilan) → nambah saldo bank
 * - discount:    potongan promo — nutup piutang tapi BUKAN uang riil (contra-receivable)
 * - recognition: penanda flip unearned → earned
 * - adjustment:  koreksi delta akibat revisi (append, bukan edit)
 * - refund:      pengembalian ke client
 */
export type LedgerEntryType =
  | "receivable"
  | "cash_in"
  | "discount"
  | "recognition"
  | "adjustment"
  | "refund";

/** Finance confirmation that money actually landed (per-transaction — "PENANDA TANGAN"). */
export type LedgerAckStatus = "pending" | "acknowledged" | "rejected";

/** One row in the append-only cashflow ledger. Denormalized for UI-first dummy. */
export interface LedgerEntry {
  id: string;
  /** Tanggal uang benar-benar bergerak, e.g. "2026-01-02". */
  occurredAt: string;
  bookingId: string;
  /** Denormalized display name, e.g. "Ridho & Tiara". */
  clientName: string;
  entryType: LedgerEntryType;
  status: LedgerStatus;
  /** Rupiah penuh (Int). Untuk baris discount = nilai potongan. */
  amount: number;
  ackStatus: LedgerAckStatus;
  /** Nama yang meng-acknowledge ("PENANDA TANGAN"), null selama pending. */
  acknowledgedBy: string | null;
  /** Rekening tujuan, e.g. "BCA 149". Null untuk baris discount (bukan uang riil). */
  paymentMethod: string | null;
  /** Nomor kwitansi/invoice, null untuk baris non-cash. */
  invoiceNumber: string | null;
  /** Nama program promo — hanya keisi saat entryType = "discount". */
  discountProgramName: string | null;
  /**
   * Termin (Term of Payment) yang di-cover pembayaran ini — OPSIONAL & bisa lebih dari satu.
   * Kosong = pembayaran tidak dilink ke termin manapun. Denormalized labels buat display.
   */
  linkedTerminIds: string[];
  linkedTerminLabels: string[];
  /** Nama file bukti bayar (kwitansi/transfer). Null = belum diupload. FE-only: nama file aja. */
  paymentEvidenceName: string | null;
  notes: string | null;
}

/** Termin/TOP option buat multi-select linking di entry drawer (FE-only dummy). */
export interface LedgerTerminOption {
  id: string;
  bookingId: string;
  /** Label termin, e.g. "DP 60%" atau "Pelunasan". */
  name: string;
  amount: number;
  dueDate: string;
}

export interface LedgerFilters {
  status?: LedgerStatus;
  entryType?: LedgerEntryType;
  search?: string;
  dateRange?: { from?: string; to?: string };
}

/** Aggregated totals for the KPI cards + money-flow bar. */
export interface LedgerSummary {
  piutang: number;
  unearned: number;
  earned: number;
  potongan: number;
}

/** Mock discount program for the entry drawer promo picker (FE-only). */
export interface LedgerPromoOption {
  id: string;
  name: string;
  discountType: "PERCENTAGE" | "NOMINAL";
  discountValue: number;
}
