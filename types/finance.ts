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
  bookingDate: string;
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
