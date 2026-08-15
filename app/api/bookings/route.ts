import { getBookings, type ApprovalStatusFilter } from "@/lib/queries/bookings";
import { requirePermissionForRoute, canViewSalesBookings, isSuperAdmin, hasPermission } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import type { DataScope } from "@/types/user";
import type { BookingStatus } from "@prisma/client";

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

  // Year filter — no default; when omitted the list shows all years.
  const rawYear = searchParams.get("year");
  const parsedYear = rawYear ? Number(rawYear) : undefined;
  const year = parsedYear && !Number.isNaN(parsedYear) ? parsedYear : undefined;

  const profileId = session.user.profileId ?? undefined;
  // dataScope is already carried on the JWT/session (refreshed from DB every 10
  // min in lib/auth.ts), so read it straight from the session instead of an extra
  // per-request DB round-trip. Falls back to "own" defensively.
  const dataScope: DataScope = session.user.dataScope ?? "own";

  const ALLOWED_APPROVAL = new Set<ApprovalStatusFilter>([
    "pending",
    "approved",
    "sales-approved",
    "sales-pending",
    "manager-approved",
    "manager-pending",
    "finance-approved",
    "finance-pending",
    "client-approved",
    "client-pending",
  ]);
  const rawApprovalStatus = searchParams.get("approvalStatus");
  const approvalStatus: ApprovalStatusFilter | undefined =
    rawApprovalStatus && ALLOWED_APPROVAL.has(rawApprovalStatus as ApprovalStatusFilter)
      ? (rawApprovalStatus as ApprovalStatusFilter)
      : undefined;

  const ALLOWED_BOOKING_STATUS = new Set<BookingStatus>([
    "Pending",
    "Uploaded",
    "Confirmed",
    "Rejected",
    "Canceled",
    "Lost",
  ]);
  const rawBookingStatus = searchParams.get("bookingStatus");
  const bookingStatus: BookingStatus | undefined =
    rawBookingStatus && ALLOWED_BOOKING_STATUS.has(rawBookingStatus as BookingStatus)
      ? (rawBookingStatus as BookingStatus)
      : undefined;

  const rawSalesId = searchParams.get("salesId") ?? undefined;
  const salesId = rawSalesId?.trim() || undefined;

  const sourceOfInformationId = searchParams.get("sourceOfInformationId")?.trim() || undefined;

  const emptyResult = () =>
    new Response(
      JSON.stringify({ data: [], total: 0 }, (_k, v) => (typeof v === "bigint" ? Number(v) : v)),
      { headers: { "content-type": "application/json" } },
    );

  // Scope guard for salesId-filtered queries.
  //  - "__none__" = sentinel for "Tanpa PIC" (detached bookings, salesId null).
  //    Not a real profile, so canViewSalesBookings can't authorize it — instead
  //    gate on elevated visibility (super admin / groups:view-all / booking:transfer)
  //    since these are orphaned bookings meant to be re-assigned.
  //  - a real salesId → verify the caller shares a group with that sales profile
  //    (or is super admin / has groups:view-all).
  // On denial we return an empty result with the same shape — no error detail exposed.
  if (salesId === "__none__") {
    const allowed =
      (await isSuperAdmin(session.user.roleId)) ||
      (await hasPermission(session.user.roleId, "groups", "view-all")) ||
      (await hasPermission(session.user.roleId, "booking", "transfer"));
    if (!allowed) return emptyResult();
  } else if (salesId) {
    if (!profileId) return emptyResult();
    const allowed = await canViewSalesBookings(profileId, session.user.roleId, salesId);
    if (!allowed) return emptyResult();
  }

  // When salesId is present, use "all" scope so the caller (e.g. a group
  // leader whose own dataScope is "own") can still see the target sales'
  // bookings — the canViewSalesBookings guard above already confirmed they
  // share a group, so visibility is intentional.
  const effectiveScope: DataScope = salesId ? "all" : dataScope;

  const result = await getBookings(profileId, effectiveScope, { page, pageSize, search, venueId, category: "WEDDINGS", recordStatus, dateFrom, dateTo, year, salesId, approvalStatus, bookingStatus, sourceOfInformationId });

  const transformed = {
    ...result,
    data: result.data.map((booking) => ({
      ...booking,
      // TOP = jadwal murni (Fase 5) — bukti bayar pindah ke Ledger cashbook.
      termOfPayments: booking.termOfPayments,
    })),
  };

  return new Response(
    JSON.stringify(transformed, (_k, v) => (typeof v === "bigint" ? Number(v) : v)),
    { headers: { "content-type": "application/json" } },
  );
}
