import bcrypt from "bcryptjs";
import { ProfileStatus } from "@prisma/client";
import { prisma } from "./_client";

// Dev-only: satu akun employee untuk menguji flow absensi end-to-end, termasuk
// Public Holiday sebagai jenis libur pilihan user di bawah DAY_OFF.
// Role human-resource sudah punya attendance:view (force-granted ke semua role),
// jadi bisa clock-in. Verifikasi sisi rekap HRD pakai akun ber-permission hr:view-all.
const TEST_EMPLOYEE = {
  email: "absen@testswa.com",
  name: "Karyawan Absen Test",
  roleName: "human-resource",
  password: "Absen@123456",
};

// Master "Hari Besar" untuk menguji cabang DAY_OFF → Public Holiday → Hari Besar.
const TEST_HOLIDAY = {
  date: new Date(Date.UTC(2026, 7, 17)), // 17 Agustus 2026 (UTC midnight)
  name: "Hari Kemerdekaan Republik Indonesia",
};

export async function seedAttendanceTestUser(): Promise<void> {
  // 1. Role
  const role = await prisma.role.findUnique({
    where: { name: TEST_EMPLOYEE.roleName },
    select: { id: true },
  });
  if (!role) {
    console.error(`❌ Role "${TEST_EMPLOYEE.roleName}" not found — jalankan db:seed:roles-permissions dulu`);
    return;
  }

  // 2. User + Profile (idempotent by unique email / unique userId)
  const hashedPassword = await bcrypt.hash(TEST_EMPLOYEE.password, 12);
  const user = await prisma.user.upsert({
    where: { email: TEST_EMPLOYEE.email },
    update: { name: TEST_EMPLOYEE.name, password: hashedPassword, emailVerified: new Date() },
    create: { email: TEST_EMPLOYEE.email, name: TEST_EMPLOYEE.name, password: hashedPassword, emailVerified: new Date() },
  });

  const profile = await prisma.profile.upsert({
    where: { userId: user.id },
    update: { roleId: role.id, status: ProfileStatus.active, isEmailVerified: true, mustChangePassword: false },
    create: {
      userId: user.id,
      email: user.email,
      fullName: TEST_EMPLOYEE.name,
      roleId: role.id,
      dataScope: "all",
      status: ProfileStatus.active,
      isEmailVerified: true,
      mustChangePassword: false,
    },
    select: { id: true },
  });

  // 3. Shift — reuse yang aktif, buat kalau belum ada
  let shift = await prisma.workShift.findFirst({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });
  if (!shift) {
    shift = await prisma.workShift.create({
      data: { name: "Shift Pagi", startTime: "08:00", endTime: "17:00", lateToleranceMinutes: 15 },
      select: { id: true, name: true },
    });
  }

  // 4. Lokasi kerja — reuse yang aktif, buat kalau belum ada
  let location = await prisma.workLocation.findFirst({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });
  if (!location) {
    location = await prisma.workLocation.create({
      data: { name: "Kantor Pusat", latitude: -6.2088, longitude: 106.8456, radiusMeters: 200 },
      select: { id: true, name: true },
    });
  }

  // 5. Penugasan default (idempotent by unique [profileId, workLocationId, workShiftId])
  await prisma.employeeWorkAssignment.upsert({
    where: {
      profileId_workLocationId_workShiftId: {
        profileId: profile.id,
        workLocationId: location.id,
        workShiftId: shift.id,
      },
    },
    update: { isDefault: true, offdayDays: [7], effectiveDate: new Date(Date.UTC(2026, 0, 1)), endDate: null },
    create: {
      profileId: profile.id,
      workLocationId: location.id,
      workShiftId: shift.id,
      isDefault: true,
      offdayDays: [7], // Minggu = libur mingguan
      effectiveDate: new Date(Date.UTC(2026, 0, 1)),
    },
  });

  // 6. Hari besar aktif (idempotent by unique date)
  const holiday = await prisma.publicHoliday.upsert({
    where: { date: TEST_HOLIDAY.date },
    update: { name: TEST_HOLIDAY.name, isActive: true },
    create: { date: TEST_HOLIDAY.date, name: TEST_HOLIDAY.name, isActive: true },
    select: { name: true, date: true },
  });

  console.log("✅ Akun test absensi siap:");
  console.log(`   Login     : ${TEST_EMPLOYEE.email} / ${TEST_EMPLOYEE.password}`);
  console.log(`   Role      : ${TEST_EMPLOYEE.roleName} (punya attendance:view)`);
  console.log(`   Shift     : ${shift.name}`);
  console.log(`   Lokasi    : ${location.name}`);
  console.log(`   Hari besar: ${holiday.name} — ${holiday.date.toISOString().slice(0, 10)}`);
}

// Run standalone
if (process.argv[1]?.includes("attendance-test-user")) {
  seedAttendanceTestUser()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
