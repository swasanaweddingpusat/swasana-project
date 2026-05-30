export type MiceBookingStatus =
  | "Pending"
  | "Uploaded"
  | "Confirmed"
  | "Rejected"
  | "Canceled"
  | "Lost";

export interface MiceTerm {
  id: string;
  name: string;
  amount: number;
  dueDate: string; // ISO
  paymentStatus: string;
}

export interface MiceBookingItem {
  id: string;
  poNumber: string | null;
  bookingDate: string; // ISO
  eventDate: string | null; // ISO
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
