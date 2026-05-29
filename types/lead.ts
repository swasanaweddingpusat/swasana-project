import type { Prisma } from "@prisma/client";

// ─── Primitive types derived from Prisma ─────────────────────────────────────

export type LeadStatusRow = {
  id: string;
  name: string;
  color: string;
  category: "WEDDINGS" | "MICE";
  sortOrder: number;
  isPipeline: boolean;
  isDefault: boolean;
  isSystem: boolean;
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
    eventType: { select: { id: true; name: true } };
    sourceOfInformation: { select: { id: true; name: true } };
    createdBy: { select: { id: true; fullName: true; nickName: true } };
  };
}>;

// Lightweight list item for table/kanban rendering
export type LeadListItem = {
  id: string;
  name: string;
  contactNumbers: ContactNumber[];
  email: string | null;
  category: "WEDDINGS" | "MICE";
  eventDate: Date | null;
  estimatedPax: number | null;
  budgetRange: string | null;
  notes: string | null;
  status: Pick<LeadStatusRow, "id" | "name" | "color">;
  venue: { id: string; name: string } | null;
  package: { id: string; packageName: string } | null;
  eventType: { id: string; name: string } | null;
  sourceOfInformation: { id: string; name: string } | null;
  createdBy: { id: string; fullName: string | null; nickName: string | null };
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
