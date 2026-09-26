import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getMiceBookings } from "@/lib/queries/bookings";
import type { DataScope } from "@/types/user";
import type {
  MiceBookingItem,
  MiceBookingStatus,
  MiceBookingsResponse,
} from "@/app/(private)/booking/booking-mice/_components/types";

export async function GET(request: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({ module: "booking-mice", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`mice-list:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || 10));
  const search = searchParams.get("search") ?? undefined;
  const status = searchParams.get("status") ?? undefined;

  const profileId = session.user.profileId ?? undefined;
  const dataScope: DataScope = session.user.dataScope ?? "own";
  const result = await getMiceBookings(profileId, dataScope, { page, pageSize, search, status });

  const data: MiceBookingItem[] = result.data.map((b) => {
    // mobileNumber is Json: array of { number, label? } — extract first entry
    let phone = "";
    const mn = b.customer?.mobileNumber as unknown;
    if (Array.isArray(mn) && mn.length > 0) {
      const first = mn[0] as { number?: string };
      phone = first?.number ?? "";
    }

    return {
      id: b.id,
      poNumber: b.poNumber ?? null,
      createdAt: b.createdAt.toISOString(),
      eventDate: b.eventDate ? b.eventDate.toISOString() : null,
      eventEndDate: b.eventEndDate ? b.eventEndDate.toISOString() : null,
      eventTime: b.eventTime,
      eventType: b.eventType
        ? { id: b.eventType.id, name: b.eventTypeName ?? b.eventType.name, code: b.eventType.code }
        : null,
      estimatedPax: b.estimatedPax,
      companyName: b.companyName,
      notes: b.notes,
      status: b.bookingStatus as MiceBookingStatus,
      customer: {
        id: b.customer?.id ?? "",
        name: b.customer?.name ?? "",
        phone,
      },
      venue: {
        id: b.venue?.id ?? "",
        name: b.venue?.name ?? "",
      },
      sales: b.sales ? { id: b.sales.id, fullName: b.sales.fullName } : null,
      sourceOfInformation: b.sourceOfInformation
        ? { id: b.sourceOfInformation.id, name: b.sourceOfInformation.name }
        : null,
      terms: b.termOfPayments.map((t) => ({
        id: t.id,
        name: t.name,
        amount: t.amount,
        dueDate: t.dueDate.toISOString(),
      })),
      quotation: b.quotation
        ? {
            id: b.quotation.id,
            quotationNo: b.quotation.quotationNo,
            status: b.quotation.status,
            totalPrice: b.quotation.totalPrice,
          }
        : null,
    };
  });

  const body: MiceBookingsResponse = { data, total: result.total };
  return Response.json(body);
}
