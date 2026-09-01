import { cacheTag } from "next/cache";
import { db } from "@/lib/db";
import type { QuotationStatus, EventCategory } from "@prisma/client";

const quotationListSelect = {
  id: true,
  quotationNo: true,
  category: true,
  status: true,
  clientName: true,
  clientPhone: true,
  instansi: true,
  venueName: true,
  eventTypeName: true,
  weddingSession: true,
  eventDate: true,
  eventEndDate: true,
  time: true,
  place: true,
  details: true,
  subtotal: true,
  discount: true,
  totalPrice: true,
  bookingFee: true,
  validUntil: true,
  notes: true,
  signingLocation: true,
  signatureSales: true,
  paymentMethodId: true,
  createdAt: true,
  updatedAt: true,
  sales: { select: { id: true, fullName: true, phoneNumber: true } },
  venue: { select: { id: true, name: true } },
  paymentMethod: { select: { id: true, bankName: true, bankAccountNumber: true, bankRecipient: true } },
  eventType: { select: { id: true, name: true } },
  items: { orderBy: { sortOrder: "asc" as const }, select: { id: true, title: true, description: true, qty: true, price: true, total: true, manualTotal: true, sortOrder: true } },
  complimentaries: {
    orderBy: { sortOrder: "asc" as const },
    select: { id: true, complimentaryId: true, name: true, price: true, isShowPrice: true, description: true, qty: true, sortOrder: true },
  },
} as const;

export type QuotationListRow = Awaited<ReturnType<typeof db.quotation.findMany<{ select: typeof quotationListSelect }>>>[number];

export interface QuotationsResult {
  data: QuotationListRow[];
  total: number;
  page: number;
  pageSize: number;
}

interface GetQuotationsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: QuotationStatus | "";
  category?: EventCategory | "";
  salesId?: string;
}

export async function getQuotations(params: GetQuotationsParams = {}): Promise<QuotationsResult> {
  "use cache";
  cacheTag("quotations");

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 10));
  const search = params.search?.trim() ?? "";

  const where = {
    ...(search
      ? {
          OR: [
            { clientName: { contains: search, mode: "insensitive" as const } },
            { clientPhone: { contains: search, mode: "insensitive" as const } },
            { instansi: { contains: search, mode: "insensitive" as const } },
            { quotationNo: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.category ? { category: params.category } : {}),
    ...(params.salesId ? { salesId: params.salesId } : {}),
  };

  const [data, total] = await Promise.all([
    db.quotation.findMany({
      where,
      select: quotationListSelect,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.quotation.count({ where }),
  ]);

  return { data, total, page, pageSize };
}

export async function getQuotationById(id: string): Promise<QuotationListRow | null> {
  "use cache";
  cacheTag("quotations");

  return db.quotation.findUnique({
    where: { id },
    select: quotationListSelect,
  });
}

// ── Approval helpers ──────────────────────────────────────────────────────────

/**
 * Fetch the approval record for a single quotation.
 * Returns null if no approval record exists (pre-feature quotation).
 * NOTE: Not cached — used in server components/route handlers that need fresh data.
 */
export async function getQuotationApprovalRecord(quotationId: string) {
  return db.approvalRecord.findUnique({
    where: { module_entityId: { module: "quotations", entityId: quotationId } },
    select: {
      id: true,
      status: true,
      steps: {
        orderBy: { stepOrder: "asc" as const },
        select: {
          id: true,
          stepOrder: true,
          approverType: true,
          approverRoleId: true,
          status: true,
          decidedAt: true,
          approverRole: { select: { id: true, name: true } },
          decidedBy: { select: { id: true, fullName: true } },
        },
      },
    },
  });
}

export type QuotationApprovalRecordResult = Awaited<ReturnType<typeof getQuotationApprovalRecord>>;

/**
 * Fetch approval statuses for a batch of quotation IDs.
 * Returns a Map<quotationId, "pending" | "approved" | "rejected" | null>
 * where null = no approval record yet.
 *
 * Used by create-MICE booking to filter only fully-approved quotations.
 */
export async function getQuotationApprovalStatuses(
  quotationIds: string[]
): Promise<Map<string, string | null>> {
  if (quotationIds.length === 0) return new Map();

  const records = await db.approvalRecord.findMany({
    where: { module: "quotations", entityId: { in: quotationIds } },
    select: { entityId: true, status: true },
  });

  const map = new Map<string, string | null>(quotationIds.map((id) => [id, null]));
  for (const r of records) {
    map.set(r.entityId, r.status);
  }
  return map;
}

/**
 * Convenience helper: returns true if a quotation approval record exists with status "approved".
 * Covers the gate for creating MICE bookings from a quotation.
 */
export async function isQuotationFullyApproved(quotationId: string): Promise<boolean> {
  const record = await db.approvalRecord.findUnique({
    where: { module_entityId: { module: "quotations", entityId: quotationId } },
    select: { status: true },
  });
  return record?.status === "approved";
}
