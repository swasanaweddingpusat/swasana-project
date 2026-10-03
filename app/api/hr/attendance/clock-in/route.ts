import type { Prisma } from "@prisma/client";
import { requirePermissionForRoute } from "@/lib/permissions";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { clockInSchema } from "@/lib/validations/attendance";
import type { FileDescriptor } from "@/lib/validations/common";
import { getAttendanceToday, todayMidnightUTC } from "@/lib/queries/attendance";
import { validateGpsAgainstLocations, determineStatus, resolveHolidayTag } from "@/lib/attendance-helpers";
import { resolveManagerId } from "@/lib/resolve-manager";
import { db } from "@/lib/db";
import { uploadToStorage, randomId12 } from "@/lib/storage";
import { compressToWebp } from "@/lib/image";
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
  const now = new Date();

  // 3. Already clocked out today? Day is locked for clock-in once closed out.
  // Re-clock-in before clock-out is allowed — the upsert below overwrites so the
  // latest submission wins (shift/workType/photo/GPS/status all re-evaluated).
  const existing = await getAttendanceToday(profileId);
  if (existing?.clockOutAt) {
    return Response.json(
      { error: "Anda sudah melakukan clock out hari ini, tidak bisa clock in ulang" },
      { status: 409 },
    );
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { attendanceStatus } = parsed.data;

  // --- Off flow: employee self-reports a day off, either plain ("Libur Mingguan") or
  // tagged as Public Holiday via the "Tipe Libur" picker. Selfie required as proof of
  // presence, but no venue/GPS (not tied to a work location). ---
  if (attendanceStatus !== "WORKDAY") {
    const { photoBase64, isPublicHoliday, publicHolidayId } = parsed.data;
    if (!photoBase64) {
      return Response.json({ error: "Foto wajib disertakan" }, { status: 422 });
    }

    const wantsPublicHoliday = isPublicHoliday === true;
    const holidayResult = await resolveHolidayTag(wantsPublicHoliday, publicHolidayId, today);
    if (!holidayResult.ok) {
      return Response.json({ error: "Public holiday tidak tersedia untuk tanggal hari ini" }, { status: 422 });
    }

    // SOP upload: random-id filename, webp, 50% quality, JSON descriptor
    const dateStr = today.toISOString().slice(0, 10);
    const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, "");
    const rawBuffer = Buffer.from(base64Data, "base64");

    let clockInEvidence: FileDescriptor;
    try {
      const compressed = await compressToWebp(rawBuffer);
      const id = randomId12();
      const path = `attendance/clock-in/${id}.webp`;
      await uploadToStorage(compressed, path, "image/webp");
      clockInEvidence = { id, name_file_origin: `day-off-${dateStr}.jpg`, mimetype: "image/webp", path };
    } catch (err) {
      console.error("[clock-in][day-off] upload error:", err);
      return Response.json({ error: "Gagal mengupload foto" }, { status: 500 });
    }

    try {
      const attendance = await db.attendance.upsert({
        where: { profileId_date: { profileId, date: today } },
        create: {
          profileId,
          date: today,
  clockInAt: now,
          attendantType: "DAY_OFF",
          isPublicHoliday: wantsPublicHoliday,
          publicHolidayId: holidayResult.id,
          publicHolidayName: holidayResult.name,
          clockInEvidence: clockInEvidence as Prisma.InputJsonValue,
        },
        update: {
          clockInAt: now,
          attendantType: "DAY_OFF",
          isPublicHoliday: wantsPublicHoliday,
          publicHolidayId: holidayResult.id,
          publicHolidayName: holidayResult.name,
          clockInEvidence: clockInEvidence as Prisma.InputJsonValue,
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
    } catch (err) {
      console.error("[clock-in][day-off] save error:", err);
      return Response.json({ error: "Gagal menyimpan absensi" }, { status: 500 });
    }
  }

  // --- Normal flow: employee self-selects shift + work type (+ venue for WFO) ---
  const { workShiftId, workLocationId, workType, workTypeReason, photoBase64, lat, lng, isPublicHoliday, publicHolidayId } = parsed.data;
  const wantsPublicHoliday = isPublicHoliday === true;
  if (!workShiftId || !workType || !photoBase64 || lat === undefined || lng === undefined) {
    return Response.json({ error: "Data absensi tidak lengkap" }, { status: 422 });
  }
  if (workType === "WFO" && !workLocationId) {
    return Response.json({ error: "Lokasi kerja wajib dipilih untuk WFO" }, { status: 422 });
  }

  const workShift = await db.workShift.findUnique({
    where: { id: workShiftId },
    select: { id: true, name: true, startTime: true, endTime: true, lateToleranceMinutes: true, isOvernight: true, isActive: true },
  });
  if (!workShift || !workShift.isActive) {
    return Response.json({ error: "Shift tidak ditemukan atau tidak aktif" }, { status: 404 });
  }

  // 4. WFO: validate the selected venue + GPS radius. WFH/WFA: no venue, GPS recorded but not validated.
  let resolvedLocationId: string | null = null;
  if (workType === "WFO") {
    const workLocation = await db.workLocation.findUnique({
      where: { id: workLocationId },
      select: { id: true, isActive: true },
    });
    if (!workLocation || !workLocation.isActive) {
      return Response.json({ error: "Lokasi kerja tidak ditemukan atau tidak aktif" }, { status: 404 });
    }

    const gpsResult = await validateGpsAgainstLocations(profileId, lat, lng, today, workLocationId ?? null);
    if (!gpsResult.valid) {
      return Response.json(
        { error: `Anda berada di luar area lokasi kerja (${Math.round(gpsResult.distance)}m dari lokasi terdekat)` },
        { status: 403 },
      );
    }
    resolvedLocationId = gpsResult.nearestLocationId;
  }

  // 5. Public Holiday tag — resolved via the shared helper (same lookup+snapshot logic
  // used by the Day Off flow above).
  const holidayResult = await resolveHolidayTag(wantsPublicHoliday, publicHolidayId, today);
  if (!holidayResult.ok) {
    return Response.json({ error: "Public holiday tidak tersedia untuk tanggal hari ini" }, { status: 422 });
  }
  const resolvedHolidayId = holidayResult.id;
  const resolvedHolidayName = holidayResult.name;

  // 6. Upload photo — SOP: random-id filename, webp, 50% quality, JSON descriptor
  const dateStr = today.toISOString().slice(0, 10);
  const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, "");
  const rawBuffer = Buffer.from(base64Data, "base64");

  let clockInEvidence: FileDescriptor;
  try {
    const compressed = await compressToWebp(rawBuffer);
    const id = randomId12();
    const path = `attendance/clock-in/${id}.webp`;
    await uploadToStorage(compressed, path, "image/webp");
    clockInEvidence = { id, name_file_origin: `clock-in-${dateStr}.jpg`, mimetype: "image/webp", path };
  } catch (err) {
    console.error("[clock-in] upload error:", err);
    return Response.json({ error: "Gagal mengupload foto" }, { status: 500 });
  }

  // 7. Determine status
  const status = determineStatus(now, workShift.startTime, workShift.lateToleranceMinutes, workShift.isOvernight);

  // WFH/WFA butuh approval 2-tahap: resolve manager sekali di submit time (snapshot),
  // biar approver-nya konsisten walau struktur organisasi berubah kemudian.
  const workTypeApproverId = workType === "WFO" ? null : await resolveManagerId(profileId);

  // 8. Upsert attendance with the employee's self-selected shift + location
  try {
    const attendance = await db.attendance.upsert({
      where: { profileId_date: { profileId, date: today } },
      create: {
        profileId,
        date: today,
        clockInAt: now,
        clockInEvidence: clockInEvidence as Prisma.InputJsonValue,
        clockInLat: lat,
        clockInLng: lng,
        status,
        workLocationId: resolvedLocationId,
        workShiftId: workShift.id,
        workType,
        attendantType: "WORKDAY",
        isPublicHoliday: wantsPublicHoliday,
        publicHolidayId: resolvedHolidayId,
        publicHolidayName: resolvedHolidayName,
        workTypeReason: workType === "WFO" ? null : (workTypeReason ?? null),
        workTypeApprovalStatus: workType === "WFO" ? null : "pending",
        workTypeApproverId,
        workTypeManagerApprovedBy: null,
        workTypeManagerApprovedAt: null,
        workTypeManagerNote: null,
        workTypeApprovedBy: null,
        workTypeApprovedAt: null,
        workTypeReviewNote: null,
      },
      update: {
        clockInAt: now,
        clockInEvidence: clockInEvidence as Prisma.InputJsonValue,
        clockInLat: lat,
        clockInLng: lng,
        status,
        workLocationId: resolvedLocationId,
        workShiftId: workShift.id,
        workType,
        attendantType: "WORKDAY",
        isPublicHoliday: wantsPublicHoliday,
        publicHolidayId: resolvedHolidayId,
        publicHolidayName: resolvedHolidayName,
        workTypeReason: workType === "WFO" ? null : (workTypeReason ?? null),
        workTypeApprovalStatus: workType === "WFO" ? null : "pending",
        workTypeApproverId,
        workTypeManagerApprovedBy: null,
        workTypeManagerApprovedAt: null,
        workTypeManagerNote: null,
        workTypeApprovedBy: null,
        workTypeApprovedAt: null,
        workTypeReviewNote: null,
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
  } catch (err) {
    console.error("[clock-in] save error:", err);
    return Response.json({ error: "Gagal menyimpan absensi" }, { status: 500 });
  }
}
