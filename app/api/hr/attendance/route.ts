import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getAttendanceList } from "@/lib/queries/attendance";
import { attendanceListQuerySchema } from "@/lib/validations/attendance";

export async function GET(req: Request) {
  const { session, response } = await requirePermissionForRoute({
    module: "hr",
    action: "view-all",
  });
  if (response) return response;
  if (!apiLimiter.check(`hr-list:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const raw = {
    profileId: searchParams.get("profileId") ?? undefined,
    venueId: searchParams.get("venueId") ?? undefined,
    date: searchParams.get("date") ?? undefined,
    month: searchParams.get("month") ?? undefined,
    year: searchParams.get("year") ?? undefined,
    page: searchParams.get("page") ?? "1",
    limit: searchParams.get("limit") ?? "50",
  };

  const parsed = attendanceListQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "Parameter tidak valid" }, { status: 400 });
  }

  try {
    const result = await getAttendanceList(parsed.data);
    return Response.json(result);
  } catch {
    return Response.json({ error: "Gagal mengambil data kehadiran" }, { status: 500 });
  }
}
