import { cacheTag } from "next/cache";
import { db } from "@/lib/db";
import type { QuotationStatus } from "@prisma/client";

const quotationListSelect = {
  id: true,
  quotationNo: true,
  status: true,
  clientName: true,
  clientPhone: true,
  instansi: true,
  salesId: true,
  venueId: true,
  venueName: true,
  eventTypeId: true,
  eventTypeName: true,
  packageId: true,
  packageName: true,
  pax: true,
  packageSource: true,
  eventDate: true,
  eventEndDate: true,
  time: true,
  place: true,
  details: true,
  subtotal: true,
  discount: true,
  discountName: true,
  totalPrice: true,
  bookingFee: true,
  termAndCondition: true,
  paymentNote: true,
  cancellationPolicy: true,
  closingNote: true,
  validUntil: true,
  notes: true,
  signingLocation: true,
  signatureSales: true,
  paymentMethodId: true,
  // Frozen bank details — rendered directly, never re-resolved from PaymentMethod.
  bankName: true,
  bankAccountNumber: true,
  bankRecipient: true,
  createdAt: true,
  updatedAt: true,
  sales: { select: { id: true, fullName: true, phoneNumber: true } },
  // No venue / eventType / paymentMethod joins: those pointers are FK-less and the
  // document renders from its own frozen columns instead.
  booking: { select: { id: true, poNumber: true } },
  items: { orderBy: { sortOrder: "asc" as const }, select: { id: true, type: true, title: true, description: true, qty: true, price: true, total: true, manualTotal: true, sortOrder: true } },
  prices: { orderBy: { sortOrder: "asc" as const }, select: { id: true, name: true, description: true, priceType: true, qty: true, price: true, total: true, sortOrder: true } },
  taxDeposits: { orderBy: { sortOrder: "asc" as const }, select: { id: true, name: true, nominal: true, sortOrder: true } },
  terms: { orderBy: { sortOrder: "asc" as const }, select: { id: true, name: true, amount: true, dueDate: true, sortOrder: true } },
  complimentaries: {
    orderBy: { sortOrder: "asc" as const },
    select: { id: true, complimentaryId: true, name: true, price: true, isShowPrice: true, description: true, qty: true, sortOrder: true },
  },
  bonuses: {
    orderBy: { sortOrder: "asc" as const },
    select: { id: true, bonusId: true, name: true, price: true, description: true, qty: true, sortOrder: true },
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
