import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getLeaveBalances } from "@/lib/queries/leaveBalances";

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!apiLimiter.check(`leave-balances-list:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const profileId = searchParams.get("profileId") ?? undefined;
  const leaveTypeId = searchParams.get("leaveTypeId") ?? undefined;
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : undefined;

  try {
    const result = await getLeaveBalances({ profileId, leaveTypeId, year });
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch leave balances" }, { status: 500 });
  }
}
