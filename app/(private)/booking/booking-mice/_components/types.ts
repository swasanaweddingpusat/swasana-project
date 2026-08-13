export type MiceBookingStatus =
  | "Pending"
  | "Uploaded"
  | "Confirmed"
  | "Rejected"
  | "Canceled"
  | "Lost";

// Fase 5: TOP = jadwal murni (nama/nominal/tanggal). Status pembayaran dilacak
// di Cashbook (Ledger), bukan lagi per termin.
export interface MiceTerm {
  id: string;
  name: string;
  amount: number;
  dueDate: string; // ISO
}

export interface MiceBookingItem {
  id: string;
  poNumber: string | null;
  createdAt: string; // ISO — kapan booking dibuat/deal
  eventDate: string | null; // ISO — tanggal acara
  status: MiceBookingStatus;
  customer: { id: string; name: string; phone: string };
  venue: { id: string; name: string };
  sales: { id: string; fullName: string | null } | null;
  sourceOfInformation: { id: string; name: string } | null;
  terms: MiceTerm[];
  quotation: null; // deferred — Quotation module not built yet
}

export interface MiceBookingsResponse {
  data: MiceBookingItem[];
  total: number;
}
