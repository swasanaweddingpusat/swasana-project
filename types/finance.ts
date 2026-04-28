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

export type ARInvoiceStatus = "paid" | "partial" | "unpaid" | "unissued" | "generated";
export type ARTerminStatus = "paid" | "partial" | "unpaid" | "pending" | "overdue" | "not_due_yet";

export interface ARFilters {
  status?: ARInvoiceStatus;
  venue?: string;
  salesPic?: string;
  dateRange?: { from: string; to: string };
}

export interface ARTermin {
  id: string;
  name: string;
  dueDate: string;
  amount: number;
  status: ARTerminStatus;
  noInvoice: string;
  statusInvoice: ARInvoiceStatus | "unissued";
  agingDays: number | null;
  catatan: string;
}

export interface ARBooking {
  id: string;
  noPo: string;
  customerEvent: string;
  customerDate: string;
  namaEvent: string;
  totalPrice: number;
  outstanding: number;
  jatuhTempo: string;
  statusTermin: ARTerminStatus;
  termins: ARTermin[];
}

