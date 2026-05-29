export type MiceStatus =
  | "Pending"
  | "Confirmed"
  | "Rejected"
  | "Canceled"
  | "Lost";

export interface MiceQuotationRef {
  id: string;
  leadName: string;
  packageName: string;
  variantName: string;
  totalPrice: number;
}

export interface MiceBookingItem {
  id: string;
  clientName: string;
  clientPhone: string;
  bookingDate: string;
  poNumber: string | null;
  quotation: MiceQuotationRef | null;
  venueName: string;
  status: MiceStatus;
  eventDate: string;
  eventType: string;
  fullPayment: number;
  bookingFee: number;
  salesName: string;
}
