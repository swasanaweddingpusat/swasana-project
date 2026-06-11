import { getBookings } from "@/lib/queries/bookings";
import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { getPublicUrl } from "@/lib/r2";
import type { DataScope } from "@/types/user";

export async function GET(request: Request) {
  const { session, response } = await requirePermissionForRoute({ module: "booking", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`bookings:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || 10));
  const search = searchParams.get("search") ?? "";
  const venueId = searchParams.get("venueId") ?? undefined;
  const rawRecordStatus = searchParams.get("recordStatus");
  const recordStatus: "saved" | "draft" | "all" | undefined =
    rawRecordStatus === "draft" ? "draft" :
    rawRecordStatus === "all" ? "all" :
    rawRecordStatus === "saved" ? "saved" :
    undefined;

  // dateFrom/dateTo arrive as full ISO instants (the client sends local day
  // start/end via toISOString) so they line up with how bookingDate is stored.
  const rawDateFrom = searchParams.get("dateFrom") ?? undefined;
  const rawDateTo = searchParams.get("dateTo") ?? undefined;
  const dateFrom = rawDateFrom && !Number.isNaN(Date.parse(rawDateFrom)) ? rawDateFrom : undefined;
  const dateTo = rawDateTo && !Number.isNaN(Date.parse(rawDateTo)) ? rawDateTo : undefined;

  const profileId = session.user.profileId ?? undefined;
  let dataScope: DataScope = "own";
  if (profileId) {
    const profile = await db.profile.findUnique({ where: { id: profileId }, select: { dataScope: true } });
    if (profile) dataScope = profile.dataScope as DataScope;
  }

  const result = await getBookings(profileId, dataScope, { page, pageSize, search, venueId, category: "WEDDINGS", recordStatus, dateFrom, dateTo });

  const transformed = {
    ...result,
    data: result.data.map((booking) => ({
      ...booking,
      termOfPayments: booking.termOfPayments.map((t) => ({
        ...t,
        paymentEvidence: t.paymentEvidence ? getPublicUrl(t.paymentEvidence) : null,
        partialPayments: t.partialPayments.map((p) => ({
          ...p,
          evidence: p.evidence ? getPublicUrl(p.evidence) : null,
        })),
      })),
    })),
  };

  return new Response(
    JSON.stringify(transformed, (_k, v) => (typeof v === "bigint" ? Number(v) : v)),
    { headers: { "content-type": "application/json" } },
  );
}
