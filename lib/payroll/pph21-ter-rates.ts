import type { PtkpStatus } from "@prisma/client";
import { getTerCategory } from "./ptkp-values";

interface TerBracket {
  maxBruto: number;
  rateA: number;
  rateB: number;
  rateC: number;
}

const TER_TABLE: TerBracket[] = [
  { maxBruto: 5_400_000, rateA: 0, rateB: 0, rateC: 0 },
  { maxBruto: 5_650_000, rateA: 0.25, rateB: 0, rateC: 0 },
  { maxBruto: 5_950_000, rateA: 0.5, rateB: 0, rateC: 0 },
  { maxBruto: 6_300_000, rateA: 0.75, rateB: 0.25, rateC: 0 },
  { maxBruto: 6_750_000, rateA: 1, rateB: 0.5, rateC: 0.25 },
  { maxBruto: 7_500_000, rateA: 1.5, rateB: 1, rateC: 0.5 },
  { maxBruto: 8_550_000, rateA: 2, rateB: 1.5, rateC: 1 },
  { maxBruto: 9_650_000, rateA: 2.5, rateB: 2, rateC: 1.5 },
  { maxBruto: 10_050_000, rateA: 3, rateB: 2.5, rateC: 2 },
  { maxBruto: 10_350_000, rateA: 3.5, rateB: 3, rateC: 2.5 },
  { maxBruto: 10_700_000, rateA: 4, rateB: 3.5, rateC: 3 },
  { maxBruto: 11_050_000, rateA: 5, rateB: 4, rateC: 3 },
  { maxBruto: 11_600_000, rateA: 6, rateB: 5, rateC: 4 },
  { maxBruto: 12_500_000, rateA: 7, rateB: 6, rateC: 5 },
  { maxBruto: 13_750_000, rateA: 8, rateB: 7, rateC: 6 },
  { maxBruto: 15_100_000, rateA: 9, rateB: 8, rateC: 7 },
  { maxBruto: 16_950_000, rateA: 10, rateB: 9, rateC: 8 },
  { maxBruto: 19_750_000, rateA: 11, rateB: 10, rateC: 9 },
  { maxBruto: 24_150_000, rateA: 12, rateB: 11, rateC: 10 },
  { maxBruto: 26_450_000, rateA: 13, rateB: 12, rateC: 11 },
  { maxBruto: 28_000_000, rateA: 14, rateB: 13, rateC: 12 },
  { maxBruto: 30_050_000, rateA: 15, rateB: 14, rateC: 13 },
  { maxBruto: 32_400_000, rateA: 16, rateB: 15, rateC: 14 },
  { maxBruto: 35_400_000, rateA: 17, rateB: 16, rateC: 15 },
  { maxBruto: 39_100_000, rateA: 18, rateB: 17, rateC: 16 },
  { maxBruto: 43_850_000, rateA: 19, rateB: 18, rateC: 17 },
  { maxBruto: 47_800_000, rateA: 20, rateB: 19, rateC: 18 },
  { maxBruto: 54_800_000, rateA: 21, rateB: 20, rateC: 19 },
  { maxBruto: 62_800_000, rateA: 22, rateB: 21, rateC: 20 },
  { maxBruto: 73_100_000, rateA: 23, rateB: 22, rateC: 21 },
  { maxBruto: 86_000_000, rateA: 24, rateB: 23, rateC: 22 },
  { maxBruto: 100_000_000, rateA: 25, rateB: 24, rateC: 23 },
  { maxBruto: 134_000_000, rateA: 26, rateB: 25, rateC: 24 },
  { maxBruto: 185_000_000, rateA: 27, rateB: 26, rateC: 25 },
  { maxBruto: 244_000_000, rateA: 28, rateB: 27, rateC: 26 },
  { maxBruto: 306_000_000, rateA: 29, rateB: 28, rateC: 27 },
  { maxBruto: 395_000_000, rateA: 30, rateB: 29, rateC: 28 },
  { maxBruto: 563_000_000, rateA: 31, rateB: 30, rateC: 29 },
  { maxBruto: 709_000_000, rateA: 32, rateB: 31, rateC: 30 },
  { maxBruto: 965_000_000, rateA: 33, rateB: 32, rateC: 31 },
  { maxBruto: 1_419_000_000, rateA: 34, rateB: 33, rateC: 32 },
  { maxBruto: Infinity, rateA: 34, rateB: 34, rateC: 34 },
];

function getTerRate(brutoMonthly: number, category: "A" | "B" | "C"): number {
  for (const bracket of TER_TABLE) {
    if (brutoMonthly <= bracket.maxBruto) {
      if (category === "A") return bracket.rateA;
      if (category === "B") return bracket.rateB;
      return bracket.rateC;
    }
  }
  return 34;
}

export function calculatePph21Ter(brutoMonthly: number, ptkpStatus: PtkpStatus): number {
  const category = getTerCategory(ptkpStatus);
  const rate = getTerRate(brutoMonthly, category);
  return Math.round((brutoMonthly * rate) / 100);
}
