/**
 * Hardcoded approval flow definitions.
 *
 * Replaces the DB-driven ApprovalFlow / ApprovalFlowStep tables.
 * Package and Booking both require: Manager (step 1) → Finance (step 2).
 *
 * Steps are resolved to actual Role rows at runtime via resolveApprovalSteps().
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
 * Resolves role names to role IDs from DB.
 * Returns null if module has no hardcoded flow or any role is not found.
 */
export async function resolveApprovalSteps(
  module: string
): Promise<ResolvedStep[] | null> {
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
 * Defaults to false (order-independent) when no flow is defined.
 */
export function isSequentialFlow(module: string): boolean {
  return APPROVAL_FLOWS[module]?.sequential === true;
}
