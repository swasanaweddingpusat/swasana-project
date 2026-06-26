import type { PtkpStatus } from "@prisma/client";

const PTKP_VALUES: Record<PtkpStatus, number> = {
  TK0: 54_000_000,
  TK1: 58_500_000,
  K0: 58_500_000,
  TK2: 63_000_000,
  K1: 63_000_000,
  TK3: 67_500_000,
  K2: 67_500_000,
  K3: 72_000_000,
};

export function getPtkpValue(status: PtkpStatus): number {
  return PTKP_VALUES[status];
}

export function getTerCategory(status: PtkpStatus): "A" | "B" | "C" {
  if (status === "TK0" || status === "TK1" || status === "K0") return "A";
  if (status === "K1" || status === "K2") return "B";
  return "C";
}
