import { test, expect } from "vitest";
import { resolveAttendanceContext } from "./attendance-helpers";
import { db } from "./db";

function mockOnce<T extends object, K extends keyof T>(obj: T, key: K, impl: T[K]) {
  const original = obj[key];
  obj[key] = impl;
  return () => { obj[key] = original; };
}

test("resolveAttendanceContext: WORKDAY + not a holiday", async () => {
  const restoreHoliday = mockOnce(db.publicHoliday, "findFirst", (async () => null) as typeof db.publicHoliday.findFirst);
  const restoreAssignment = mockOnce(db.employeeWorkAssignment, "findFirst", (async () => ({ offdayDays: [6, 7] })) as unknown as typeof db.employeeWorkAssignment.findFirst);
  try {
    const result = await resolveAttendanceContext("profile-1", new Date("2026-09-15T00:00:00.000Z")); // Tuesday
    expect(result).toEqual({ attendantType: "WORKDAY", isPublicHoliday: false, publicHolidayName: null });
  } finally {
    restoreHoliday();
    restoreAssignment();
  }
});

test("resolveAttendanceContext: DAY_OFF + not a holiday", async () => {
  const restoreHoliday = mockOnce(db.publicHoliday, "findFirst", (async () => null) as typeof db.publicHoliday.findFirst);
  const restoreAssignment = mockOnce(db.employeeWorkAssignment, "findFirst", (async () => ({ offdayDays: [6, 7] })) as unknown as typeof db.employeeWorkAssignment.findFirst);
  try {
    const result = await resolveAttendanceContext("profile-1", new Date("2026-09-19T00:00:00.000Z")); // Saturday
    expect(result).toEqual({ attendantType: "DAY_OFF", isPublicHoliday: false, publicHolidayName: null });
  } finally {
    restoreHoliday();
    restoreAssignment();
  }
});

test("resolveAttendanceContext: WORKDAY + is a holiday", async () => {
  const restoreHoliday = mockOnce(db.publicHoliday, "findFirst", (async () => ({ id: "h1", name: "Hari Besar Test" })) as unknown as typeof db.publicHoliday.findFirst);
  const restoreAssignment = mockOnce(db.employeeWorkAssignment, "findFirst", (async () => ({ offdayDays: [6, 7] })) as unknown as typeof db.employeeWorkAssignment.findFirst);
  try {
    const result = await resolveAttendanceContext("profile-1", new Date("2026-09-15T00:00:00.000Z")); // Tuesday, holiday
    expect(result).toEqual({ attendantType: "WORKDAY", isPublicHoliday: true, publicHolidayName: "Hari Besar Test" });
  } finally {
    restoreHoliday();
    restoreAssignment();
  }
});

test("resolveAttendanceContext: DAY_OFF + is a holiday (independent computation)", async () => {
  const restoreHoliday = mockOnce(db.publicHoliday, "findFirst", (async () => ({ id: "h1", name: "Hari Besar Test" })) as unknown as typeof db.publicHoliday.findFirst);
  const restoreAssignment = mockOnce(db.employeeWorkAssignment, "findFirst", (async () => ({ offdayDays: [6, 7] })) as unknown as typeof db.employeeWorkAssignment.findFirst);
  try {
    const result = await resolveAttendanceContext("profile-1", new Date("2026-09-19T00:00:00.000Z")); // Saturday, holiday
    expect(result).toEqual({ attendantType: "DAY_OFF", isPublicHoliday: true, publicHolidayName: "Hari Besar Test" });
  } finally {
    restoreHoliday();
    restoreAssignment();
  }
});

test("resolveAttendanceContext: no assignment found defaults to WORKDAY", async () => {
  const restoreHoliday = mockOnce(db.publicHoliday, "findFirst", (async () => null) as typeof db.publicHoliday.findFirst);
  const restoreAssignment = mockOnce(db.employeeWorkAssignment, "findFirst", (async () => null) as unknown as typeof db.employeeWorkAssignment.findFirst);
  try {
    const result = await resolveAttendanceContext("profile-1", new Date("2026-09-15T00:00:00.000Z"));
    expect(result).toEqual({ attendantType: "WORKDAY", isPublicHoliday: false, publicHolidayName: null });
  } finally {
    restoreHoliday();
    restoreAssignment();
  }
});
