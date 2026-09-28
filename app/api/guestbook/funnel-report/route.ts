import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getGuestbookFunnelReport, type GuestbookCategoryFilter } from "@/lib/queries/guestbookEntries";
import type { DataScope } from "@/types/user";

const ALLOWED_CATEGORY = new Set<GuestbookCategoryFilter>(["WEDDINGS", "MICE", "no_package"]);

/** Parses a comma-separated query param into a trimmed, non-empty string array. */
function parseListParam(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  const values = raw.split(",").map((v) => v.trim()).filter(Boolean);
  return values.length > 0 ? values : undefined;
}

export async function GET(request: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "guestbook",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`guestbook-funnel-report:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() || undefined;
  const venueIds = parseListParam(searchParams.get("venueIds"));
  const hostId = searchParams.get("hostId")?.trim() || undefined;
  const dateFrom = searchParams.get("dateFrom")?.trim() || undefined;
  const dateTo = searchParams.get("dateTo")?.trim() || undefined;

  const categories = parseListParam(searchParams.get("categories"))?.filter((v): v is GuestbookCategoryFilter =>
    ALLOWED_CATEGORY.has(v as GuestbookCategoryFilter)
  );

  // Status kini berupa ID ProspectStatus; validitasnya dijamin relasi DB.
  const statusIds = parseListParam(searchParams.get("statusIds"));

  const sourceOfInformationIds = parseListParam(searchParams.get("sourceOfInformationIds"));
  const festivalIds = parseListParam(searchParams.get("festivalIds"));

  const profileId = session.user.profileId ?? undefined;
  // dataScope is already carried on the JWT/session (refreshed from DB every 10
  // min in lib/auth.ts), so read it straight from the session instead of an extra
  // per-request DB round-trip. Falls back to "own" defensively.
  const dataScope: DataScope = session.user.dataScope ?? "own";

  try {
    const result = await getGuestbookFunnelReport(profileId, dataScope, {
      search,
      venueIds,
      hostId,
      dateFrom,
      dateTo,
      categories,
      statusIds,
      sourceOfInformationIds,
      festivalIds,
    });
    return Response.json(result);
  } catch (error) {
    console.error("[GET /api/guestbook/funnel-report]", error);
    return Response.json({ error: "Failed to fetch guestbook funnel report" }, { status: 500 });
  }
}
