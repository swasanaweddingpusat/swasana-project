import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getLeaveCalendar } from "@/lib/queries/leaveRequests";

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!apiLimiter.check(`leave-calendar:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const departmentId = searchParams.get("departmentId") ?? undefined;
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");

  if (!startDateParam || !endDateParam) {
    return Response.json({ error: "startDate and endDate are required" }, { status: 400 });
  }

  const startDate = new Date(startDateParam);
  const endDate = new Date(endDateParam);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return Response.json({ error: "Invalid date format" }, { status: 400 });
  }

  try {
    const result = await getLeaveCalendar({ departmentId, startDate, endDate });
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch leave calendar" }, { status: 500 });
  }
}
