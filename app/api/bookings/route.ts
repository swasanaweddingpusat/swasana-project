import { getBookings } from "@/lib/queries/bookings";
import { requirePermissionForRoute, canViewSalesBookings } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getPublicUrl } from "@/lib/storage";
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
  // start/end via toISOString) so they line up with how eventDate is stored.
  const rawDateFrom = searchParams.get("dateFrom") ?? undefined;
  const rawDateTo = searchParams.get("dateTo") ?? undefined;
  const dateFrom = rawDateFrom && !Number.isNaN(Date.parse(rawDateFrom)) ? rawDateFrom : undefined;
  const dateTo = rawDateTo && !Number.isNaN(Date.parse(rawDateTo)) ? rawDateTo : undefined;

  const profileId = session.user.profileId ?? undefined;
  // dataScope is already carried on the JWT/session (refreshed from DB every 10
  // min in lib/auth.ts), so read it straight from the session instead of an extra
  // per-request DB round-trip. Falls back to "own" defensively.
  const dataScope: DataScope = session.user.dataScope ?? "own";

  const rawApprovalStatus = searchParams.get("approvalStatus");
  const approvalStatus: "pending" | "approved" | undefined =
    rawApprovalStatus === "pending" ? "pending" :
    rawApprovalStatus === "approved" ? "approved" :
    undefined;

  const rawSalesId = searchParams.get("salesId") ?? undefined;
  const salesId = rawSalesId?.trim() || undefined;

  // Scope guard: when salesId is requested, verify the caller shares a group
  // with that sales profile (or is super admin / has groups:view-all).
  // On denial we return an empty result with the same shape — no error detail
  // exposed to the client.
  if (salesId) {
    if (!profileId) {
      return new Response(
        JSON.stringify({ data: [], total: 0 }, (_k, v) => (typeof v === "bigint" ? Number(v) : v)),
        { headers: { "content-type": "application/json" } },
      );
    }
    const allowed = await canViewSalesBookings(profileId, session.user.roleId, salesId);
    if (!allowed) {
      return new Response(
        JSON.stringify({ data: [], total: 0 }, (_k, v) => (typeof v === "bigint" ? Number(v) : v)),
        { headers: { "content-type": "application/json" } },
      );
    }
  }

  // When salesId is present, use "all" scope so the caller (e.g. a group
  // leader whose own dataScope is "own") can still see the target sales'
  // bookings — the canViewSalesBookings guard above already confirmed they
  // share a group, so visibility is intentional.
  const effectiveScope: DataScope = salesId ? "all" : dataScope;

  const result = await getBookings(profileId, effectiveScope, { page, pageSize, search, venueId, category: "WEDDINGS", recordStatus, dateFrom, dateTo, salesId, approvalStatus });

  const transformed = {
    ...result,
    data: result.data.map((booking) => ({
      ...booking,
      // partialPayments dropped from the list include — only paymentEvidence on the
      // TOP base fields needs URL resolution for the list view.
      termOfPayments: booking.termOfPayments.map((t) => ({
        ...t,
        paymentEvidence: t.paymentEvidence ? getPublicUrl(t.paymentEvidence) : null,
      })),
    })),
  };

  return new Response(
    JSON.stringify(transformed, (_k, v) => (typeof v === "bigint" ? Number(v) : v)),
    { headers: { "content-type": "application/json" } },
  );
}
