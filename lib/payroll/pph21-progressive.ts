import type { PtkpStatus } from "@prisma/client";
import { getPtkpValue } from "./ptkp-values";

const PROGRESSIVE_BRACKETS: { limit: number; rate: number }[] = [
  { limit: 60_000_000, rate: 0.05 },
  { limit: 250_000_000, rate: 0.15 },
  { limit: 500_000_000, rate: 0.25 },
  { limit: 5_000_000_000, rate: 0.30 },
  { limit: Infinity, rate: 0.35 },
];

export function calculatePph21Progressive(
  brutoMonthly: number,
  ptkpStatus: PtkpStatus,
  jhtEmployeeMonthly: number,
  jpEmployeeMonthly: number,
): number {
  const brutoAnnual = brutoMonthly * 12;
  const biayaJabatan = Math.min(brutoAnnual * 0.05, 6_000_000);
  const iuranTahunan = (jhtEmployeeMonthly + jpEmployeeMonthly) * 12;
  const netoAnnual = brutoAnnual - biayaJabatan - iuranTahunan;
  const ptkp = getPtkpValue(ptkpStatus);
  const pkp = Math.max(0, netoAnnual - ptkp);

  let taxAnnual = 0;
  let remaining = pkp;
  let prevLimit = 0;

  for (const bracket of PROGRESSIVE_BRACKETS) {
    const taxable = Math.min(remaining, bracket.limit - prevLimit);
    if (taxable <= 0) break;
    taxAnnual += taxable * bracket.rate;
    remaining -= taxable;
    prevLimit = bracket.limit;
  }

  return Math.round(taxAnnual / 12);
}
