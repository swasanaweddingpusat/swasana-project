import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getMiceBookings } from "@/lib/queries/bookings";
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

  const result = await getMiceBookings({ page, pageSize, search, status });

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
      quotation: null,
    };
  });

  const body: MiceBookingsResponse = { data, total: result.total };
  return Response.json(body);
}
