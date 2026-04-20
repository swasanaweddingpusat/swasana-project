import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getPackages } from "@/lib/queries/packages";

export async function GET(request: Request) {
  const { session, response } = await requirePermissionForRoute({
    module: "package",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`packages-list:${session.user.id}`)) return rateLimitResponse();

  try {
    const { searchParams } = new URL(request.url);
    const venueId = searchParams.get("venueId") ?? undefined;
    const result = await getPackages(venueId);
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch packages" }, { status: 500 });
  }
}
