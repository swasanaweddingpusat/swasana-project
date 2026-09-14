import { requirePermissionForRoute } from "@/lib/permissions";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { clockInSchema } from "@/lib/validations/attendance";
import { getAttendanceToday, todayMidnightUTC } from "@/lib/queries/attendance";
import { validateGpsAgainstLocations, determineStatus } from "@/lib/attendance-helpers";
import { db } from "@/lib/db";
import { uploadToStorage } from "@/lib/storage";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  // 1. Auth + rate limit
  const { session, response } = await requirePermissionForRoute({
    module: "attendance",
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

  // 3. Already clocked in today?
  const existing = await getAttendanceToday(profileId);
  if (existing?.clockInAt) {
    return Response.json({ error: "Anda sudah melakukan clock in hari ini" }, { status: 409 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const holiday = await db.publicHoliday.findUnique({ where: { date: today }, select: { id: true } });
  const isPublicHoliday = holiday !== null;

  // --- Off flow: employee self-reports a day off, no selfie/GPS required ---
  if (parsed.data.isOff) {
    try {
      const attendance = await db.attendance.upsert({
        where: { profileId_date: { profileId, date: today } },
        create: {
          profileId,
          date: today,
          attendantType: "DAY_OFF",
          isPublicHoliday,
        },
        update: {
          attendantType: "DAY_OFF",
          isPublicHoliday,
        },
      });

      await logAudit({
        userId: session.user.profileId,
        action: "hr.mark_day_off",
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

  // --- Normal flow: employee self-selects shift + venue at clock-in time ---
  const { workShiftId, workLocationId, photoBase64, lat, lng } = parsed.data;
  if (!workShiftId || !workLocationId || !photoBase64 || lat === undefined || lng === undefined) {
    return Response.json({ error: "Data absensi tidak lengkap" }, { status: 422 });
  }

  const workShift = await db.workShift.findUnique({
    where: { id: workShiftId },
    select: { id: true, name: true, startTime: true, endTime: true, lateToleranceMinutes: true, isOvernight: true, isActive: true },
  });
  if (!workShift || !workShift.isActive) {
    return Response.json({ error: "Shift tidak ditemukan atau tidak aktif" }, { status: 404 });
  }

  const workLocation = await db.workLocation.findUnique({
    where: { id: workLocationId },
    select: { id: true, isActive: true },
  });
  if (!workLocation || !workLocation.isActive) {
    return Response.json({ error: "Lokasi kerja tidak ditemukan atau tidak aktif" }, { status: 404 });
  }

  // 4. Validate GPS against the employee's self-selected location
  const gpsResult = await validateGpsAgainstLocations(profileId, lat, lng, today, workLocationId);
  if (!gpsResult.valid) {
    return Response.json(
      { error: `Anda berada di luar area lokasi kerja (${Math.round(gpsResult.distance)}m dari lokasi terdekat)` },
      { status: 403 },
    );
  }

  // 5. Upload photo
  const now = new Date();
  const dateStr = today.toISOString().slice(0, 10);
  const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, "");
  const photoBuffer = Buffer.from(base64Data, "base64");
  const photoKey = `attendance/${profileId}/${dateStr}/clock-in-${Date.now()}.jpg`;

  let photoUrl: string;
  try {
    photoUrl = await uploadToStorage(photoBuffer, photoKey, "image/jpeg");
  } catch (err) {
    console.error("[clock-in] R2 upload error:", err);
    return Response.json({ error: "Gagal mengupload foto" }, { status: 500 });
  }

  // 6. Determine status
  const status = determineStatus(now, workShift.startTime, workShift.lateToleranceMinutes, workShift.isOvernight);

  // 7. Upsert attendance with the employee's self-selected shift + location
  try {
    const attendance = await db.attendance.upsert({
      where: { profileId_date: { profileId, date: today } },
      create: {
        profileId,
        date: today,
        clockInAt: now,
        clockInPhotoUrl: photoUrl,
        clockInLat: lat,
        clockInLng: lng,
        status,
        workLocationId: gpsResult.nearestLocationId,
        workShiftId: workShift.id,
        attendantType: "WORKDAY",
        isPublicHoliday,
      },
      update: {
        clockInAt: now,
        clockInPhotoUrl: photoUrl,
        clockInLat: lat,
        clockInLng: lng,
        status,
        workLocationId: gpsResult.nearestLocationId,
        workShiftId: workShift.id,
        attendantType: "WORKDAY",
        isPublicHoliday,
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
