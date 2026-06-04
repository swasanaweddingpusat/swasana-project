/**
 * Approval flow definitions — DB-driven with hardcoded fallback.
 *
 * Primary source: ApprovalFlowConfig + ApprovalFlowStep rows in DB.
 * Fallback (safety net): APPROVAL_FLOWS constant below — used when DB rows
 * don't exist yet or a role is missing. This ensures booking/package/quotation
 * approvals continue to work even before the Settings UI seeds data.
 *
 * resolveApprovalSteps() tries DB first, falls back to constants.
 */

import { db } from "@/lib/db";

export interface HardcodedStep {
  sortOrder: number;
  approverType: "role";
  roleName: string;
}

export interface ApprovalFlowDef {
  /**
   * When true, each step must be approved in stepOrder sequence (lower order first).
   * When false (default), all role steps can be approved in any order — the record
   * is marked approved only when ALL steps are done.
   */
  sequential?: boolean;
  steps: HardcodedStep[];
}

/** Hardcoded fallback — kept exactly in sync with original behavior */
export const APPROVAL_FLOWS: Record<string, ApprovalFlowDef> = {
  package: {
    steps: [
      { sortOrder: 1, approverType: "role", roleName: "manager" },
      { sortOrder: 2, approverType: "role", roleName: "finance" },
    ],
  },
  booking: {
    steps: [
      { sortOrder: 1, approverType: "role", roleName: "manager" },
      { sortOrder: 2, approverType: "role", roleName: "finance" },
    ],
  },
  quotations: {
    steps: [
      { sortOrder: 1, approverType: "role", roleName: "manager" },
      { sortOrder: 2, approverType: "role", roleName: "finance" },
    ],
  },
  catering: {
    sequential: true,
    steps: [
      { sortOrder: 1, approverType: "role", roleName: "finance" },
      { sortOrder: 2, approverType: "role", roleName: "direktur-operational" },
      { sortOrder: 3, approverType: "role", roleName: "operational" },
    ],
  },
  decoration: {
    sequential: true,
    steps: [
      { sortOrder: 1, approverType: "role", roleName: "finance" },
      { sortOrder: 2, approverType: "role", roleName: "direktur-operational" },
      { sortOrder: 3, approverType: "role", roleName: "operational" },
    ],
  },
};

export interface ResolvedStep {
  sortOrder: number;
  approverType: "role";
  approverRoleId: string;
  roleName: string;
}

/**
 * Resolves approval steps for a given module.
 *
 * Strategy:
 * 1. Try DB (ApprovalFlowConfig + ApprovalFlowStep).
 * 2. If DB has no rows for this module, fall back to APPROVAL_FLOWS constant.
 * 3. Returns null if neither DB nor fallback has a valid flow.
 */
export async function resolveApprovalSteps(
  module: string
): Promise<ResolvedStep[] | null> {
  // ── 1. Try DB-driven flow ───────────────────────────────────────────────────
  const dbFlow = await db.approvalFlowConfig.findUnique({
    where: { module },
    select: {
      steps: {
        orderBy: { stepOrder: "asc" },
        select: {
          stepOrder: true,
          approverRoleId: true,
          approverRole: { select: { name: true } },
        },
      },
    },
  });

  if (dbFlow && dbFlow.steps.length > 0) {
    return dbFlow.steps.map((s) => ({
      sortOrder: s.stepOrder,
      approverType: "role" as const,
      approverRoleId: s.approverRoleId,
      roleName: s.approverRole.name,
    }));
  }

  // ── 2. Fallback to hardcoded constant ───────────────────────────────────────
  const flowDef = APPROVAL_FLOWS[module];
  if (!flowDef || flowDef.steps.length === 0) return null;

  const roleNames = flowDef.steps.map((s) => s.roleName);
  const roles = await db.role.findMany({
    where: { name: { in: roleNames } },
    select: { id: true, name: true },
  });

  const roleMap = new Map(roles.map((r) => [r.name, r.id]));

  const resolved: ResolvedStep[] = [];
  for (const step of flowDef.steps) {
    const roleId = roleMap.get(step.roleName);
    if (!roleId) return null; // role missing in DB — fail safely
    resolved.push({
      sortOrder: step.sortOrder,
      approverType: step.approverType,
      approverRoleId: roleId,
      roleName: step.roleName,
    });
  }

  return resolved;
}

/**
 * Returns true if the given module's approval flow is sequential (strict order).
 * Checks DB first, falls back to hardcoded constant, defaults to false.
 */
export async function isSequentialFlow(module: string): Promise<boolean> {
  const dbFlow = await db.approvalFlowConfig.findUnique({
    where: { module },
    select: { sequential: true },
  });

  if (dbFlow !== null) return dbFlow.sequential;

  // Fallback to hardcoded constant
  return APPROVAL_FLOWS[module]?.sequential === true;
}

/**
 * Converts a role slug (e.g. "direktur-operational") into a human-readable
 * label (e.g. "Direktur Operational") for display in documents/PDFs.
 * Returns "" for empty/null input.
 */
export function humanizeRoleName(slug: string | null | undefined): string {
  if (!slug) return "";
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
