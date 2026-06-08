import { requireAnyPermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getEventTypes } from "@/lib/queries/event-types";

export async function GET(req: Request) {
  // Event types are shared reference data — readable by anyone who works with
  // bookings, MICE bookings, leads, or quotations.
  const { session, response } = await requireAnyPermissionForRoute([
    { module: "booking", action: "view" },
    { module: "booking-mice", action: "view" },
    { module: "leads", action: "view" },
    { module: "quotations", action: "view" },
  ]);
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
