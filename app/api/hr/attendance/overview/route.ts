import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getEmployeeAttendanceOverview } from "@/lib/queries/attendance";
import { attendanceOverviewQuerySchema } from "@/lib/validations/attendance";

export async function GET(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "hr",
    action: "view-all",
  });
  if (response) return response;
  if (!apiLimiter.check(`hr-attendance-overview:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const raw = {
    profileId: searchParams.get("profileId") ?? undefined,
    date: searchParams.get("date") ?? undefined,
    month: searchParams.get("month") ?? undefined,
    year: searchParams.get("year") ?? undefined,
  };

  const parsed = attendanceOverviewQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 422 });
  }

  try {
    const data = await getEmployeeAttendanceOverview(parsed.data);
    if (!data.profile) {
      return Response.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });
    }
    return Response.json(data);
  } catch {
    return Response.json({ error: "Gagal mengambil data overview" }, { status: 500 });
  }
}
