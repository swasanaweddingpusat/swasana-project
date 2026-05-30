import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getEventTypes } from "@/lib/queries/event-types";

export async function GET(req: Request) {
  const { session, response } = await requirePermissionForRoute({
    module: "booking",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`event-types:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const categoryParam = searchParams.get("category");
  const category =
    categoryParam === "WEDDINGS" || categoryParam === "MICE"
      ? categoryParam
      : undefined;

  try {
    const eventTypes = await getEventTypes(category);
    return Response.json(eventTypes);
  } catch {
    return Response.json({ error: "Gagal mengambil event types" }, { status: 500 });
  }
}
