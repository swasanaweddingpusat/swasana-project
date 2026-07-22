import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { isForeignKeyViolation } from "@/lib/prisma-errors";

function knownRequestError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("FK violation", {
    code,
    clientVersion: "7.8.0",
  });
}

/**
 * Mirrors the real DriverAdapterError shape observed in the deleteUser failure
 * log: a top-level Error whose Postgres SQLSTATE lives nested in `cause`.
 */
function driverAdapterError(code: string): Error {
  const err = new Error(
    'update or delete on table "profiles" violates RESTRICT setting of foreign key constraint',
  );
  err.name = "DriverAdapterError";
  (err as { cause?: unknown }).cause = {
    originalCode: code,
    code,
    kind: "postgres",
    severity: "ERROR",
  };
  return err;
}

describe("isForeignKeyViolation", () => {
  it("detects Prisma's own P2003 code", () => {
    expect(isForeignKeyViolation(knownRequestError("P2003"))).toBe(true);
  });

  it("detects a DriverAdapterError with nested 23001 (RESTRICT violation)", () => {
    // This is the exact case from the log: onDelete: Restrict FK on booking.salesId
    // raises SQLSTATE 23001, wrapped in a DriverAdapterError's `cause`.
    expect(isForeignKeyViolation(driverAdapterError("23001"))).toBe(true);
  });

  it("detects a DriverAdapterError with nested 23503 (foreign_key_violation)", () => {
    expect(isForeignKeyViolation(driverAdapterError("23503"))).toBe(true);
  });

  it("detects a plain error object carrying a top-level 23001 code", () => {
    const err = Object.assign(new Error("restrict violation"), { code: "23001" });
    expect(isForeignKeyViolation(err)).toBe(true);
  });

  it("does NOT match a unique violation (P2002 / 23505)", () => {
    expect(isForeignKeyViolation(knownRequestError("P2002"))).toBe(false);
    expect(isForeignKeyViolation(driverAdapterError("23505"))).toBe(false);
  });

  it("does NOT match a non-Prisma, code-less error", () => {
    expect(isForeignKeyViolation(new Error("boom"))).toBe(false);
    expect(isForeignKeyViolation(null)).toBe(false);
    expect(isForeignKeyViolation(undefined)).toBe(false);
  });
});
