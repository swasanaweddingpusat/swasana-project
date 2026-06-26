import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getWorkLocations } from "@/lib/queries/workLocations";

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!apiLimiter.check(`work-locations:${session.user.id}`)) return rateLimitResponse();

  try {
    const result = await getWorkLocations();
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch work locations" }, { status: 500 });
  }
}
