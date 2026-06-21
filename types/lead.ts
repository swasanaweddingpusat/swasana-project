import type { Prisma, WeddingSession } from "@prisma/client";

// ─── Primitive types derived from Prisma ─────────────────────────────────────

export type LeadStatusRow = {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
  isFinal: boolean;
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ContactNumber = {
  label: string;
  number: string;
};

// ─── Aggregated / joined types used in UI ────────────────────────────────────

export type LeadWithRelations = Prisma.LeadGetPayload<{
  include: {
    status: true;
    venue: { select: { id: true; name: true } };
    package: { select: { id: true; packageName: true } };
    eventType: { select: { id: true; name: true; category: true } };
    sourceOfInformation: { select: { id: true; name: true } };
    createdBy: { select: { id: true; fullName: true; nickName: true } };
    assignedTo: { select: { id: true; fullName: true; nickName: true } };
    convertedToCustomer: { select: { id: true; name: true } };
    convertedToBooking: { select: { id: true } };
  };
}>;

// Lightweight list item for table/kanban rendering
export type LeadListItem = {
  id: string;
  name: string;
  contactNumbers: ContactNumber[];
  email: string | null;
  emailCpp: string | null;
  emailCpw: string | null;
  nikCpp: string | null;
  nikCpw: string | null;
  addressCpp: string | null;
  addressCpw: string | null;
  address: string | null;
  eventDate: Date | null;
  eventDateAlt: Date | null;
  time: string | null;
  estimatedPax: number | null;
  budgetRange: string | null;
  notes: string | null;
  category: "WEDDINGS" | "MICE";
  weddingSession: WeddingSession | null;
  weddingSessionAlt: WeddingSession | null;
  bitrixId: string | null;
  instansi: string | null;
  isDateLocked: boolean;
  bookingFeeAmount: number | null;
  bookingFeeDate: Date | null;
  bookingFeeEvidenceUrl: string | null;
  status: Pick<LeadStatusRow, "id" | "name" | "color" | "isFinal" | "isSystem">;
  venue: { id: string; name: string } | null;
  venueSecondary: { id: string; name: string } | null;
  package: { id: string; packageName: string } | null;
  eventType: { id: string; name: string; category: "WEDDINGS" | "MICE"; code: string } | null;
  sourceOfInformation: { id: string; name: string } | null;
  createdBy: { id: string; fullName: string | null; nickName: string | null };
  assignedTo: { id: string; fullName: string | null; nickName: string | null } | null;
  convertedToCustomer: { id: string; name: string } | null;
  convertedToBooking: { id: string } | null;
  convertedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

// Payload passed from a Lead into a booking drawer (wedding or MICE) to
// pre-fill the create form. All fields optional — the drawer fills what it can.
export type BookingPrefillLead = {
  leadId: string;
  name: string;
  contactNumbers: ContactNumber[];
  email: string | null;
  address: string | null;
  bitrixId: string | null;
  eventDate: Date | string | null;
  time: string | null;
  estimatedPax: number | null;
  notes: string | null;
  weddingSession: WeddingSession | null;
  venue: { id: string; name: string } | null;
  package: { id: string; packageName: string } | null;
  eventType: { id: string; name: string; category: "WEDDINGS" | "MICE" } | null;
  sourceOfInformation: { id: string; name: string } | null;
  assignedTo: { id: string; fullName: string | null; nickName: string | null } | null;
};

// Paginated response
export type PaginatedLeads = {
  items: LeadListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
