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
  address: string | null;
  eventDate: Date | null;
  estimatedPax: number | null;
  budgetRange: string | null;
  notes: string | null;
  category: "WEDDINGS" | "MICE";
  weddingSession: WeddingSession | null;
  bitrixId: string | null;
  status: Pick<LeadStatusRow, "id" | "name" | "color" | "isFinal" | "isSystem">;
  venue: { id: string; name: string } | null;
  package: { id: string; packageName: string } | null;
  eventType: { id: string; name: string; category: "WEDDINGS" | "MICE" } | null;
  sourceOfInformation: { id: string; name: string } | null;
  createdBy: { id: string; fullName: string | null; nickName: string | null };
  assignedTo: { id: string; fullName: string | null; nickName: string | null } | null;
  convertedToCustomer: { id: string; name: string } | null;
  convertedToBooking: { id: string } | null;
  convertedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

// Paginated response
export type PaginatedLeads = {
  items: LeadListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
