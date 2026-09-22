import type { Prisma } from "@prisma/client";
import { requirePermissionForRoute } from "@/lib/permissions";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { clockInSchema } from "@/lib/validations/attendance";
import type { FileDescriptor } from "@/lib/validations/common";
import { getAttendanceToday, todayMidnightUTC } from "@/lib/queries/attendance";
import { validateGpsAgainstLocations, determineStatus } from "@/lib/attendance-helpers";
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

  // 3. Already clocked in today?
  const existing = await getAttendanceToday(profileId);
  if (existing?.clockInAt) {
    return Response.json({ error: "Anda sudah melakukan clock in hari ini" }, { status: 409 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { attendanceStatus } = parsed.data;

  // --- Off flow: employee self-reports a day off, and picks the jenis libur (Libur Biasa
  // vs Public Holiday). Selfie required as proof of presence, but no venue/GPS (not tied to
  // a work location). ---
  if (attendanceStatus !== "WORKDAY") {
    const { photoBase64, dayOffType, publicHolidayId } = parsed.data;
    if (!dayOffType) {
      return Response.json({ error: "Jenis libur wajib dipilih" }, { status: 422 });
    }
    if (!photoBase64) {
      return Response.json({ error: "Foto wajib disertakan" }, { status: 422 });
    }

    // Karyawan memilih apakah hari ini Public Holiday (tanggal merah) atau libur biasa.
    // Identitas "hari besar" (nama) ditentukan HRD lewat master PublicHoliday: server
    // mencocokkan tanggal absen dengan master by-date lalu meng-snapshot namanya supaya
    // absensi tetap tampil benar bila master di-rename/hapus. Karyawan tak memilih nama.
    const isPublicHoliday = dayOffType === "PUBLIC_HOLIDAY";
    const holiday = isPublicHoliday
      ? await db.publicHoliday.findFirst({
          where: { id: publicHolidayId, date: { lte: today }, isActive: true },
          select: { id: true, name: true },
        })
      : null;
    if (isPublicHoliday && !holiday) {
      return Response.json({ error: "Public holiday tidak tersedia untuk tanggal hari ini" }, { status: 422 });
    }
    const resolvedHolidayId: string | null = holiday?.id ?? null;
    const resolvedHolidayName: string | null = holiday?.name ?? null;

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
          isPublicHoliday,
          publicHolidayId: resolvedHolidayId,
          publicHolidayName: resolvedHolidayName,
          clockInEvidence: clockInEvidence as Prisma.InputJsonValue,
        },
        update: {
          clockInAt: now,
          attendantType: "DAY_OFF",
          isPublicHoliday,
          publicHolidayId: resolvedHolidayId,
          publicHolidayName: resolvedHolidayName,
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
  const { workShiftId, workLocationId, workType, photoBase64, lat, lng } = parsed.data;
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

  // 5. Upload photo — SOP: random-id filename, webp, 50% quality, JSON descriptor
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

  // 6. Determine status. Public Holiday is a jenis libur chosen on the off flow, never a
  // workday marker — a WORKDAY attendance is never flagged as tanggal merah.
  const status = determineStatus(now, workShift.startTime, workShift.lateToleranceMinutes, workShift.isOvernight);

  // 7. Upsert attendance with the employee's self-selected shift + location
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
        isPublicHoliday: false,
        publicHolidayId: null,
        publicHolidayName: null,
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
        isPublicHoliday: false,
        publicHolidayId: null,
        publicHolidayName: null,
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
