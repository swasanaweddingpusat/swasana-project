import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { resolveGroupOwnerIds } from "@/lib/access-control";
import { getEligibleMiceQuotations } from "@/lib/queries/miceBookings";

export async function GET(request: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "booking-mice",
    action: "create",
  });
  if (response) return response;
  if (!apiLimiter.check(`eligible-mice-quotations:${session.user.id}`)) {
    return rateLimitResponse();
  }

  const search = new URL(request.url).searchParams.get("search")?.trim() ?? "";
  if (search.length < 2) return Response.json({ data: [] });

  const profileId = session.user.profileId;
  const scope = session.user.dataScope ?? "own";
  let salesIds: string[] | undefined;
  if (scope === "own") {
    salesIds = profileId ? [profileId] : [];
  } else if (scope === "group") {
    salesIds = profileId ? await resolveGroupOwnerIds(profileId) : [];
  }

  const data = await getEligibleMiceQuotations(search, salesIds, 10);
  return Response.json({ data });
}
