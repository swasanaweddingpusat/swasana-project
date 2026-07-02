import { requirePermissionForRoute } from "@/lib/permissions";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { clockInSchema } from "@/lib/validations/attendance";
import { getAttendanceToday, todayMidnightUTC } from "@/lib/queries/attendance";
import { resolveEmployeeShift, validateGpsAgainstLocations, determineStatus } from "@/lib/attendance-helpers";
import { db } from "@/lib/db";
import { uploadToStorage } from "@/lib/storage";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  // 1. Auth + rate limit
  const { session, response } = await requirePermissionForRoute({
    module: "hr",
    action: "view",
  });
  if (response) return response;
  if (!mutationLimiter.check(`clock-in:${session.user.id}`)) return rateLimitResponse();

  // 2. Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Request body tidak valid" }, { status: 400 });
  }

  const parsed = clockInSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 422 });
  }

  const profileId = session.user.profileId;
  if (!profileId) {
    return Response.json({ error: "Profile tidak ditemukan" }, { status: 404 });
  }

  const today = todayMidnightUTC();

  // 3. Resolve shift
  const resolved = await resolveEmployeeShift(profileId, today);
  if (!resolved) {
    return Response.json({ error: "Anda belum di-assign ke shift/lokasi kerja" }, { status: 409 });
  }

  // 4. Validate GPS against assigned locations
  const gpsResult = await validateGpsAgainstLocations(
    profileId,
    parsed.data.lat,
    parsed.data.lng,
    today,
    resolved.workLocationId,
  );
  if (!gpsResult.valid) {
    return Response.json(
      { error: `Anda berada di luar area lokasi kerja (${Math.round(gpsResult.distance)}m dari lokasi terdekat)` },
      { status: 403 },
    );
  }

  // 5. Check existing clock-in
  const existing = await getAttendanceToday(profileId);
  if (existing?.clockInAt) {
    return Response.json({ error: "Anda sudah melakukan clock in hari ini" }, { status: 409 });
  }

  // 6. Upload photo
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const now = new Date();
  const dateStr = today.toISOString().slice(0, 10);
  const base64Data = parsed.data.photoBase64.replace(/^data:image\/\w+;base64,/, "");
  const photoBuffer = Buffer.from(base64Data, "base64");
  const photoKey = `attendance/${profileId}/${dateStr}/clock-in-${Date.now()}.jpg`;

  let photoUrl: string;
  try {
    photoUrl = await uploadToStorage(photoBuffer, photoKey, "image/jpeg");
  } catch (err) {
    console.error("[clock-in] R2 upload error:", err);
    return Response.json({ error: "Gagal mengupload foto" }, { status: 500 });
  }

  // 7. Determine status
  const status = determineStatus(
    now,
    resolved.workShift.startTime,
    resolved.workShift.lateToleranceMinutes,
    resolved.workShift.isOvernight,
  );

  // 8. Upsert attendance with workLocationId and workShiftId
  try {
    const attendance = await db.attendance.upsert({
      where: { profileId_date: { profileId, date: today } },
      create: {
        profileId,
        date: today,
        clockInAt: now,
        clockInPhotoUrl: photoUrl,
        clockInLat: parsed.data.lat,
        clockInLng: parsed.data.lng,
        status,
        workLocationId: gpsResult.nearestLocationId,
        workShiftId: resolved.workShiftId,
      },
      update: {
        clockInAt: now,
        clockInPhotoUrl: photoUrl,
        clockInLat: parsed.data.lat,
        clockInLng: parsed.data.lng,
        status,
        workLocationId: gpsResult.nearestLocationId,
        workShiftId: resolved.workShiftId,
      },
    });

    await logAudit({
      userId: session.user.profileId,
      action: "hr.clock_in",
      result: "success",
      entityType: "Attendance",
      entityId: attendance.id,
      ipAddress: ip,
    });

    return Response.json(attendance, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal menyimpan absensi" }, { status: 500 });
  }
}
