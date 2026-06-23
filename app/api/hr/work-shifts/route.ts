import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getWorkShifts } from "@/lib/queries/workShifts";

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!apiLimiter.check(`work-shifts:${session.user.id}`)) return rateLimitResponse();

  try {
    const result = await getWorkShifts();
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch work shifts" }, { status: 500 });
  }
}
