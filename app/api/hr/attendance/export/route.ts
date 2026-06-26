import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getAttendanceForExport } from "@/lib/queries/attendance";
import { attendanceExportQuerySchema } from "@/lib/validations/attendance";

export async function GET(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "hr",
    action: "view-all",
  });
  if (response) return response;
  if (!apiLimiter.check(`hr-export:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const raw = {
    profileId: searchParams.get("profileId") ?? undefined,
    date: searchParams.get("date") ?? undefined,
    month: searchParams.get("month") ?? undefined,
    year: searchParams.get("year") ?? undefined,
  };

  const parsed = attendanceExportQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "Parameter tidak valid" }, { status: 400 });
  }

  try {
    const data = await getAttendanceForExport(parsed.data);
    return Response.json(data);
  } catch {
    return Response.json({ error: "Gagal mengambil data export" }, { status: 500 });
  }
}
