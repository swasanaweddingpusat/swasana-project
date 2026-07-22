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
  /**
   * Invoice ENTITY aktif (status=issued) yang terbit buat termin ini (FIX C).
   * `noInvoice`/`statusInvoice` sekarang derived dari entity `Invoice` ini juga
   * (FIX C Step 3: TermOfPayment.invoiceNumber sudah di-drop dari schema).
   * null = belum ada invoice diterbitkan buat termin ini.
   */
  invoice: { id: string; number: string; type: string; status: string; issuedAt: string } | null;
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
  salesId: string | null;
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
  salesId: string | null;
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

// ─── Ledger Types ─────────────────────────────────────────────────────────────
//
// Cashbook (buku besar cash-in) sekarang pakai DB nyata — tipe read-model-nya
// hidup di lib/queries/ledger.ts (`LedgerRow`, `LedgerActivity`, dst). Blok tipe
// dummy lama (LedgerEntry/LedgerSummary/LedgerFilters/…) sudah dihapus pada
// cutover Fase 4; jangan tambahkan tipe Ledger di sini lagi.
