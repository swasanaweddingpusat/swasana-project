import test from "node:test";
import assert from "node:assert/strict";
import { resolveAttendanceContext } from "./attendance-helpers";
import { db } from "./db";

function mockOnce<T extends object, K extends keyof T>(obj: T, key: K, impl: T[K]) {
  const original = obj[key];
  obj[key] = impl;
  return () => { obj[key] = original; };
}

test("resolveAttendanceContext: WORKDAY + not a holiday", async () => {
  const restoreHoliday = mockOnce(db.publicHoliday, "findUnique", (async () => null) as typeof db.publicHoliday.findUnique);
  const restoreAssignment = mockOnce(db.employeeWorkAssignment, "findFirst", (async () => ({ offdayDays: [6, 7] })) as unknown as typeof db.employeeWorkAssignment.findFirst);
  try {
    const result = await resolveAttendanceContext("profile-1", new Date("2026-09-15T00:00:00.000Z")); // Tuesday
    assert.deepEqual(result, { attendantType: "WORKDAY", isPublicHoliday: false });
  } finally {
    restoreHoliday();
    restoreAssignment();
  }
});

test("resolveAttendanceContext: DAY_OFF + not a holiday", async () => {
  const restoreHoliday = mockOnce(db.publicHoliday, "findUnique", (async () => null) as typeof db.publicHoliday.findUnique);
  const restoreAssignment = mockOnce(db.employeeWorkAssignment, "findFirst", (async () => ({ offdayDays: [6, 7] })) as unknown as typeof db.employeeWorkAssignment.findFirst);
  try {
    const result = await resolveAttendanceContext("profile-1", new Date("2026-09-19T00:00:00.000Z")); // Saturday
    assert.deepEqual(result, { attendantType: "DAY_OFF", isPublicHoliday: false });
  } finally {
    restoreHoliday();
    restoreAssignment();
  }
});

test("resolveAttendanceContext: WORKDAY + is a holiday", async () => {
  const restoreHoliday = mockOnce(db.publicHoliday, "findUnique", (async () => ({ id: "h1" })) as unknown as typeof db.publicHoliday.findUnique);
  const restoreAssignment = mockOnce(db.employeeWorkAssignment, "findFirst", (async () => ({ offdayDays: [6, 7] })) as unknown as typeof db.employeeWorkAssignment.findFirst);
  try {
    const result = await resolveAttendanceContext("profile-1", new Date("2026-09-15T00:00:00.000Z")); // Tuesday, holiday
    assert.deepEqual(result, { attendantType: "WORKDAY", isPublicHoliday: true });
  } finally {
    restoreHoliday();
    restoreAssignment();
  }
});

test("resolveAttendanceContext: DAY_OFF + is a holiday (independent computation)", async () => {
  const restoreHoliday = mockOnce(db.publicHoliday, "findUnique", (async () => ({ id: "h1" })) as unknown as typeof db.publicHoliday.findUnique);
  const restoreAssignment = mockOnce(db.employeeWorkAssignment, "findFirst", (async () => ({ offdayDays: [6, 7] })) as unknown as typeof db.employeeWorkAssignment.findFirst);
  try {
    const result = await resolveAttendanceContext("profile-1", new Date("2026-09-19T00:00:00.000Z")); // Saturday, holiday
    assert.deepEqual(result, { attendantType: "DAY_OFF", isPublicHoliday: true });
  } finally {
    restoreHoliday();
    restoreAssignment();
  }
});

test("resolveAttendanceContext: no assignment found defaults to WORKDAY", async () => {
  const restoreHoliday = mockOnce(db.publicHoliday, "findUnique", (async () => null) as typeof db.publicHoliday.findUnique);
  const restoreAssignment = mockOnce(db.employeeWorkAssignment, "findFirst", (async () => null) as unknown as typeof db.employeeWorkAssignment.findFirst);
  try {
    const result = await resolveAttendanceContext("profile-1", new Date("2026-09-15T00:00:00.000Z"));
    assert.deepEqual(result, { attendantType: "WORKDAY", isPublicHoliday: false });
  } finally {
    restoreHoliday();
    restoreAssignment();
  }
});
