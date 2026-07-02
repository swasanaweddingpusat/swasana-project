import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getShiftOverrides } from "@/lib/queries/shiftOverrides";

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!apiLimiter.check(`shift-overrides:${session.user.id}`)) return rateLimitResponse();

  try {
    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get("profileId") ?? undefined;
    const startDate = searchParams.get("startDate") ?? undefined;
    const endDate = searchParams.get("endDate") ?? undefined;

    const result = await getShiftOverrides({ profileId, startDate, endDate });
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch shift overrides" }, { status: 500 });
  }
}
