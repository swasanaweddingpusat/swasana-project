import test from "node:test";
import assert from "node:assert/strict";
import { normalizeOffdayDays, isOffdayForDate, formatOffdayDays } from "./attendance-offdays";

test("normalizes and checks weekly offdays", () => {
  assert.deepEqual(normalizeOffdayDays([1, 3, 5, 8] as number[]), [1, 3, 5]);
  assert.equal(isOffdayForDate([1, 3, 5], new Date("2026-07-06T00:00:00.000Z")), true);
  assert.equal(isOffdayForDate([1, 3, 5], new Date("2026-07-07T00:00:00.000Z")), false);
  assert.equal(formatOffdayDays([1, 3, 5]), "Senin, Rabu, Jumat");
});
