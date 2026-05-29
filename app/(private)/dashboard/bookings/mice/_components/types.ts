export interface MiceBookingItem {
  id: string;
  clientName: string;
  clientPhone: string;
  bookingDate: string;
  poNumber: string | null;
  hasQuotation: boolean;
  venueName: string;
  status: "Pending" | "Confirmed" | "Uploaded" | "Rejected" | "Canceled" | "Lost";
  eventDate: string;
  eventType: string;
  fullPayment: number;
  bookingFee: number;
  salesName: string;
}
