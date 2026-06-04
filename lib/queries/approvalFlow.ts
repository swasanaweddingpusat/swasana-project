import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { APPROVAL_FLOWS } from "@/lib/approval-flows";

/**
 * All configured modules — from DB rows or hardcoded fallback.
 * Used by Settings UI to know which modules exist.
 */
export const KNOWN_MODULES = [
  { module: "booking", label: "Booking Wedding" },
  { module: "package", label: "Package" },
  { module: "quotations", label: "Quotation" },
  { module: "catering", label: "Catering" },
  { module: "decoration", label: "Decoration" },
  { module: "payment", label: "Payment Acknowledgment" },
] as const;

export type KnownModule = (typeof KNOWN_MODULES)[number]["module"];

export interface ApprovalFlowWithSteps {
  id: string | null; // null = only in hardcoded fallback, not yet in DB
  module: string;
  label: string;
  sequential: boolean;
  steps: {
    id: string | null;
    stepOrder: number;
    approverRoleId: string;
    roleName: string;
    label: string | null;
  }[];
}

/**
 * Load all approval flow configs with their steps.
 * Merges DB rows with KNOWN_MODULES list — modules missing from DB show
 * the hardcoded fallback values so Settings UI can display them.
 */
export async function getAllApprovalFlows(): Promise<ApprovalFlowWithSteps[]> {
  "use cache";
  cacheTag("approval-flows");
  cacheLife("minutes");

  const dbFlows = await db.approvalFlowConfig.findMany({
    select: {
      id: true,
      module: true,
      label: true,
      sequential: true,
      steps: {
        orderBy: { stepOrder: "asc" },
        select: {
          id: true,
          stepOrder: true,
          approverRoleId: true,
          label: true,
          approverRole: { select: { name: true } },
        },
      },
    },
    orderBy: { module: "asc" },
  });

  const dbByModule = new Map(dbFlows.map((f) => [f.module, f]));

  return KNOWN_MODULES.map(({ module, label: defaultLabel }) => {
    const db = dbByModule.get(module);
    if (db) {
      return {
        id: db.id,
        module: db.module,
        label: db.label ?? defaultLabel,
        sequential: db.sequential,
        steps: db.steps.map((s) => ({
          id: s.id,
          stepOrder: s.stepOrder,
          approverRoleId: s.approverRoleId,
          roleName: s.approverRole.name,
          label: s.label,
        })),
      };
    }

    // Fallback from hardcoded constant (rows not yet in DB)
    const fallback = APPROVAL_FLOWS[module];
    return {
      id: null,
      module,
      label: defaultLabel,
      sequential: fallback?.sequential ?? false,
      steps:
        fallback?.steps.map((s, idx) => ({
          id: null,
          stepOrder: s.sortOrder,
          approverRoleId: "", // resolved at runtime
          roleName: s.roleName,
          label: null,
        })) ?? [],
    };
  });
}

export type ApprovalFlowsResult = Awaited<ReturnType<typeof getAllApprovalFlows>>;
