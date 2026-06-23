import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getAttendanceSettings } from "@/lib/queries/attendance";
import { attendanceSettingsSchema } from "@/lib/validations/attendance";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const { session, response } = await requirePermissionForRoute({
    module: "hr",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`hr-settings:${session.user.id}`)) return rateLimitResponse();

  try {
    const settings = await getAttendanceSettings();
    return Response.json(settings);
  } catch {
    return Response.json({ error: "Gagal mengambil data settings" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const { session, response } = await requirePermissionForRoute({
    module: "hr",
    action: "view-all",
  });
  if (response) return response;
  if (!mutationLimiter.check(`hr-settings-update:${session.user.id}`)) return rateLimitResponse();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Request body tidak valid" }, { status: 400 });
  }

  const parsed = attendanceSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 422 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  try {
    const existing = await db.attendanceSettings.findFirst();

    let settings;
    if (existing) {
      settings = await db.attendanceSettings.update({
        where: { id: existing.id },
        data: parsed.data,
      });
    } else {
      settings = await db.attendanceSettings.create({
        data: parsed.data,
      });
    }

    await logAudit({
      userId: session.user.profileId,
      action: "hr.settings_updated",
      result: "success",
      entityType: "AttendanceSettings",
      entityId: settings.id,
      changes: parsed.data,
      ipAddress: ip,
    });

    return Response.json(settings);
  } catch {
    return Response.json({ error: "Gagal menyimpan settings" }, { status: 500 });
  }
}
