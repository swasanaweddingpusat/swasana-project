import { requirePermissionForRoute } from "@/lib/permissions";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { clockOutSchema } from "@/lib/validations/attendance";
import { getAttendanceToday, getAttendanceSettings } from "@/lib/queries/attendance";
import { db } from "@/lib/db";
import { uploadToR2 } from "@/lib/r2";
import { logAudit } from "@/lib/audit";

function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function POST(req: Request) {
  const { session, response } = await requirePermissionForRoute({
    module: "hr",
    action: "view",
  });
  if (response) return response;
  if (!mutationLimiter.check(`clock-out:${session.user.id}`)) return rateLimitResponse();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Request body tidak valid" }, { status: 400 });
  }

  const parsed = clockOutSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 422 });
  }

  const profileId = session.user.profileId;
  if (!profileId) {
    return Response.json({ error: "Profile tidak ditemukan" }, { status: 404 });
  }

  const settings = await getAttendanceSettings();
  if (!settings) {
    return Response.json({ error: "Settings absensi belum dikonfigurasi" }, { status: 409 });
  }

  const distance = haversineDistance(
    parsed.data.lat, parsed.data.lng,
    settings.officeLatitude, settings.officeLongitude,
  );

  if (distance > settings.officeRadiusMeters) {
    return Response.json(
      { error: `Anda berada di luar area kantor (${Math.round(distance)}m dari kantor)` },
      { status: 403 },
    );
  }

  const existing = await getAttendanceToday(profileId);
  if (!existing?.clockInAt) {
    return Response.json({ error: "Anda belum melakukan clock in hari ini" }, { status: 409 });
  }
  if (existing.clockOutAt) {
    return Response.json({ error: "Anda sudah melakukan clock out hari ini" }, { status: 409 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const now = new Date();
  const dateStr = existing.date.toISOString().slice(0, 10);

  const base64Data = parsed.data.photoBase64.replace(/^data:image\/\w+;base64,/, "");
  const photoBuffer = Buffer.from(base64Data, "base64");
  const photoKey = `attendance/${profileId}/${dateStr}/clock-out-${Date.now()}.jpg`;

  let photoUrl: string;
  try {
    photoUrl = await uploadToR2(photoBuffer, photoKey, "image/jpeg");
  } catch {
    return Response.json({ error: "Gagal mengupload foto" }, { status: 500 });
  }

  try {
    const attendance = await db.attendance.update({
      where: { id: existing.id },
      data: {
        clockOutAt: now,
        clockOutPhotoUrl: photoUrl,
        clockOutLat: parsed.data.lat,
        clockOutLng: parsed.data.lng,
      },
    });

    await logAudit({
      userId: session.user.profileId,
      action: "hr.clock_out",
      result: "success",
      entityType: "Attendance",
      entityId: attendance.id,
      ipAddress: ip,
    });

    return Response.json(attendance);
  } catch {
    return Response.json({ error: "Gagal menyimpan absensi" }, { status: 500 });
  }
}
