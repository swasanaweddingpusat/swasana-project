import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getWorkAssignments } from "@/lib/queries/workAssignments";

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!apiLimiter.check(`work-assignments:${session.user.id}`)) return rateLimitResponse();

  try {
    const { searchParams } = new URL(req.url);
    const workLocationId = searchParams.get("workLocationId") ?? undefined;
    const workShiftId = searchParams.get("workShiftId") ?? undefined;
    const profileId = searchParams.get("profileId") ?? undefined;

    const result = await getWorkAssignments({ workLocationId, workShiftId, profileId });
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch work assignments" }, { status: 500 });
  }
}
