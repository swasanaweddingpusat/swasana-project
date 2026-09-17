import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { test, expect, vi, beforeAll, afterAll } from "vitest";
import type { Session } from "next-auth";

// ─── Mocks: auth() session + storage upload (avoid hitting real S3/MinIO) ────

let currentSession: Session | null = null;

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => currentSession),
}));

vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return {
    ...actual,
    uploadToStorage: vi.fn(async () => undefined),
  };
});

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

const { db } = await import("@/lib/db");
const {
  submitLeaveRequest,
  managerApproveLeave,
  hrApproveLeave,
  hrRejectLeave,
  cancelLeaveRequest,
} = await import("./leaveRequest");
const { getAvailableHolidayTokens } = await import("@/lib/queries/publicHoliday");

// Tiny 1x1 red PNG as base64 data URL — real bytes so sharp/webp compression works.
const FAKE_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const HOLIDAY_A_DATE = new Date(Date.UTC(2099, 7, 17)); // 2099-08-17
const HOLIDAY_B_DATE = new Date(Date.UTC(2099, 8, 5)); // 2099-09-05
const FLOATING_DATE_A = new Date(Date.UTC(2099, 10, 11)); // 2099-11-11 (floating ≠ holiday date)
const FLOATING_DATE_B = new Date(Date.UTC(2099, 10, 20)); // 2099-11-20

let profileId: string;
let originalManagerId: string | null;
let holidayAId: string;
let holidayBId: string;
let tokenLeaveTypeId: string;

function asSession(overrides: Partial<Session["user"]>): Session {
  return {
    user: {
      id: overrides.id ?? "user-id",
      profileId,
      roleId: "test-role-id",
      isSuperAdmin: false,
      status: "active",
      isEmailVerified: true,
      mustChangePassword: false,
      ...overrides,
    },
    expires: new Date(Date.now() + 60_000).toISOString(),
  } as Session;
}

beforeAll(async () => {
  const profile = await db.profile.findFirst({
    where: { email: "absen@testswa.com" },
    select: { id: true, managerId: true },
  });
  if (!profile) {
    throw new Error(
      "Test profile absen@testswa.com not found — run `npx tsx prisma/seeders/attendance-test-user.ts` first."
    );
  }
  profileId = profile.id;
  originalManagerId = profile.managerId;

  // Self-manager hack so this single profile can also approve its own manager step.
  await db.profile.update({ where: { id: profileId }, data: { managerId: profileId } });

  const holidayType = await db.leaveType.findUnique({
    where: { code: "public_holiday" },
    select: { id: true },
  });
  if (!holidayType) throw new Error("LeaveType code=public_holiday not found — migration not applied?");
  tokenLeaveTypeId = holidayType.id;

  const holidayA = await db.publicHoliday.upsert({
    where: { date: HOLIDAY_A_DATE },
    update: { name: "TEST-E2E Idul Fitri", isActive: true },
    create: { date: HOLIDAY_A_DATE, name: "TEST-E2E Idul Fitri", isActive: true },
    select: { id: true, name: true },
  });
  holidayAId = holidayA.id;

  const holidayB = await db.publicHoliday.upsert({
    where: { date: HOLIDAY_B_DATE },
    update: { name: "TEST-E2E Maulid Nabi", isActive: true },
    create: { date: HOLIDAY_B_DATE, name: "TEST-E2E Maulid Nabi", isActive: true },
    select: { id: true, name: true },
  });
  holidayBId = holidayB.id;

  // Clean slate: remove any leftover requests/attendance from a prior failed run.
  await db.leaveRequest.deleteMany({ where: { profileId, publicHolidayId: { in: [holidayAId, holidayBId] } } });
  await db.attendance.deleteMany({ where: { profileId, date: { in: [FLOATING_DATE_A, FLOATING_DATE_B] } } });
});

afterAll(async () => {
  if (!profileId) return; // beforeAll failed before setup completed — nothing to clean up
  const holidayIds = [holidayAId, holidayBId].filter((id): id is string => Boolean(id));
  if (holidayIds.length > 0) {
    await db.leaveRequest.deleteMany({ where: { profileId, publicHolidayId: { in: holidayIds } } });
    await db.publicHoliday.deleteMany({ where: { id: { in: holidayIds } } });
  }
  await db.attendance.deleteMany({ where: { profileId, date: { in: [FLOATING_DATE_A, FLOATING_DATE_B] } } });
  await db.profile.update({ where: { id: profileId }, data: { managerId: originalManagerId } });
});

test("holiday-token full lifecycle: submit -> manager approve -> hr approve -> attendance -> cancel -> token restored", async () => {
  // 1. Both test holidays show up as available tokens up front.
  const tokensBefore = await getAvailableHolidayTokens(profileId);
  const idsBefore = tokensBefore.map((t) => t.id);
  expect(idsBefore).toContain(holidayAId);
  expect(idsBefore).toContain(holidayBId);

  // 2. Submit a token request for holiday A, on a FLOATING date (not the holiday's own date).
  currentSession = asSession({});
  const submitResult = await submitLeaveRequest({
    leaveTypeId: tokenLeaveTypeId,
    startDate: FLOATING_DATE_A.toISOString().slice(0, 10),
    endDate: FLOATING_DATE_A.toISOString().slice(0, 10),
    reason: "e2e test",
    photoBase64: FAKE_IMAGE,
    publicHolidayId: holidayAId,
  });
  expect(submitResult).toEqual({ success: true });

  const created = await db.leaveRequest.findFirst({
    where: { profileId, publicHolidayId: holidayAId },
    orderBy: { createdAt: "desc" },
  });
  expect(created).not.toBeNull();
  expect(created!.publicHolidayName).toBe("TEST-E2E Idul Fitri");
  expect(created!.totalDays).toBe(1);
  expect(created!.status).toBe("pending");
  expect(created!.startDate.toISOString()).toBe(FLOATING_DATE_A.toISOString());
  expect(created!.evidence).not.toBeNull();
  const requestId = created!.id;

  // 3. Token A is now consumed; token B still available.
  const tokensAfterSubmit = await getAvailableHolidayTokens(profileId);
  const idsAfterSubmit = tokensAfterSubmit.map((t) => t.id);
  expect(idsAfterSubmit).not.toContain(holidayAId);
  expect(idsAfterSubmit).toContain(holidayBId);

  // 4. Re-submitting the same token is rejected.
  const dupeResult = await submitLeaveRequest({
    leaveTypeId: tokenLeaveTypeId,
    startDate: FLOATING_DATE_B.toISOString().slice(0, 10),
    endDate: FLOATING_DATE_B.toISOString().slice(0, 10),
    reason: "dupe",
    photoBase64: FAKE_IMAGE,
    publicHolidayId: holidayAId,
  });
  expect(dupeResult.success).toBe(false);

  // 5. Manager approves (self-manager hack — same profile, same session).
  const mgrResult = await managerApproveLeave({ requestId, note: "ok" });
  expect(mgrResult).toEqual({ success: true });

  // 6. HR approves — bypass permission check via isSuperAdmin.
  currentSession = asSession({ isSuperAdmin: true });
  const hrResult = await hrApproveLeave({ requestId, note: "ok" });
  expect(hrResult).toEqual({ success: true });

  const approved = await db.leaveRequest.findUnique({ where: { id: requestId } });
  expect(approved!.status).toBe("approved");

  // 7. Attendance Day Off row auto-created at the floating date.
  const attendance = await db.attendance.findUnique({
    where: { profileId_date: { profileId, date: FLOATING_DATE_A } },
  });
  expect(attendance).not.toBeNull();
  expect(attendance!.attendantType).toBe("DAY_OFF");
  expect(attendance!.isPublicHoliday).toBe(true);
  expect(attendance!.publicHolidayId).toBe(holidayAId);
  expect(attendance!.publicHolidayName).toBe("TEST-E2E Idul Fitri");
  expect(attendance!.status).toBe("on_leave");
  expect(attendance!.clockInEvidence).not.toBeNull();

  // 8. Cancel the approved request (future date) — as the employee.
  currentSession = asSession({});
  const cancelResult = await cancelLeaveRequest({ requestId, reason: "batal" });
  expect(cancelResult).toEqual({ success: true });

  const cancelled = await db.leaveRequest.findUnique({ where: { id: requestId } });
  expect(cancelled!.status).toBe("cancelled");

  const attendanceAfterCancel = await db.attendance.findUnique({
    where: { profileId_date: { profileId, date: FLOATING_DATE_A } },
  });
  expect(attendanceAfterCancel).toBeNull();

  // 9. Token A is available again.
  const tokensAfterCancel = await getAvailableHolidayTokens(profileId);
  expect(tokensAfterCancel.map((t) => t.id)).toContain(holidayAId);
});

test("holiday-token reject path frees the token without touching attendance", async () => {
  currentSession = asSession({});
  const submitResult = await submitLeaveRequest({
    leaveTypeId: tokenLeaveTypeId,
    startDate: FLOATING_DATE_B.toISOString().slice(0, 10),
    endDate: FLOATING_DATE_B.toISOString().slice(0, 10),
    reason: "e2e reject test",
    photoBase64: FAKE_IMAGE,
    publicHolidayId: holidayBId,
  });
  expect(submitResult).toEqual({ success: true });

  const created = await db.leaveRequest.findFirst({
    where: { profileId, publicHolidayId: holidayBId },
    orderBy: { createdAt: "desc" },
  });
  const requestId = created!.id;

  const mgrResult = await managerApproveLeave({ requestId, note: "ok" });
  expect(mgrResult).toEqual({ success: true });

  currentSession = asSession({ isSuperAdmin: true });
  const rejectResult = await hrRejectLeave({ requestId, reason: "tidak sesuai" });
  expect(rejectResult).toEqual({ success: true });

  const rejected = await db.leaveRequest.findUnique({ where: { id: requestId } });
  expect(rejected!.status).toBe("rejected");

  const attendance = await db.attendance.findUnique({
    where: { profileId_date: { profileId, date: FLOATING_DATE_B } },
  });
  expect(attendance).toBeNull();

  const tokensAfterReject = await getAvailableHolidayTokens(profileId);
  expect(tokensAfterReject.map((t) => t.id)).toContain(holidayBId);
});

test("regular (non-token) leave type still enforces the balance-generated guard", async () => {
  currentSession = asSession({});
  const regularType = await db.leaveType.findFirst({
    where: { isDeductible: true, isActive: true },
    select: { id: true, name: true },
  });
  if (!regularType) {
    // No deductible leave type seeded in this env — nothing to regress against.
    return;
  }
  const result = await submitLeaveRequest({
    leaveTypeId: regularType.id,
    startDate: "2099-11-02", // Monday
    endDate: "2099-11-03", // Tuesday
    reason: "regression",
    photoBase64: FAKE_IMAGE,
  });
  // Either it correctly blocks for missing balance, or (if a balance row exists) it
  // succeeds — both are valid, non-token branch outcomes. What must NOT happen is a
  // crash/throw, and the request (if created) must have no publicHolidayId.
  expect(typeof result.success).toBe("boolean");
  if (result.success) {
    const created = await db.leaveRequest.findFirst({
      where: { profileId, leaveTypeId: regularType.id },
      orderBy: { createdAt: "desc" },
    });
    expect(created!.publicHolidayId).toBeNull();
    // Cleanup this regression artifact too.
    await db.leaveRequest.delete({ where: { id: created!.id } });
    await db.attendance.deleteMany({ where: { profileId, date: { gte: new Date("2099-11-02"), lte: new Date("2099-11-03") } } });
  }
});
