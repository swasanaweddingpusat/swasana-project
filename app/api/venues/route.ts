import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getVenues } from "@/lib/queries/venues";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!apiLimiter.check(`venues:${session.user.id}`)) return rateLimitResponse();

  try {
    const venues = await getVenues();
    return Response.json(venues.map((v) => ({ id: v.id, name: v.name })));
  } catch {
    return Response.json({ error: "Failed to fetch venues" }, { status: 500 });
  }
}
