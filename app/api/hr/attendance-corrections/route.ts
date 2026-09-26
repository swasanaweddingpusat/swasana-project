import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { requirePermissionForRoute } from "@/lib/permissions";
import { getAttendanceCorrections } from "@/lib/queries/attendanceCorrections";

export async function GET(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({ module: "hr-attendance", action: "view" });
  if (response) return response;

  if (!apiLimiter.check(`attendance-corrections-list:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const departmentId = searchParams.get("departmentId") ?? undefined;
  const profileId = searchParams.get("profileId") ?? undefined;

  try {
    const result = await getAttendanceCorrections({ status, departmentId, profileId });
    return Response.json(result);
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Failed to fetch attendance corrections" }, { status: 500 });
  }
}
