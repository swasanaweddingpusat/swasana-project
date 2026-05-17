import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getPackages, getPackagesForBooking } from "@/lib/queries/packages";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const venueId = searchParams.get("venueId") ?? undefined;
  const forBooking = searchParams.get("forBooking") === "true";

  let userId: string;
  if (forBooking) {
    const { auth } = await import("@/lib/auth");
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
    userId = session.user.id;
  } else {
    const { session, response } = await requirePermissionForRoute({ module: "package", action: "view" });
    if (response) return response;
    userId = session.user.id;
  }

  if (!apiLimiter.check(`packages-list:${userId}`)) return rateLimitResponse();

  try {
    const result = forBooking ? await getPackagesForBooking(venueId) : await getPackages(venueId);
    return Response.json(result);
  } catch (error) {
    console.error("[GET /api/packages]", error);
    return Response.json({ error: "Failed to fetch packages" }, { status: 500 });
  }
}
