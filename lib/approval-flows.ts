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

export const APPROVAL_FLOWS: Record<string, HardcodedStep[]> = {
  package: [
    { sortOrder: 1, approverType: "role", roleName: "manager" },
    { sortOrder: 2, approverType: "role", roleName: "finance" },
  ],
  booking: [
    { sortOrder: 1, approverType: "role", roleName: "manager" },
    { sortOrder: 2, approverType: "role", roleName: "finance" },
  ],
  catering: [
    { sortOrder: 1, approverType: "role", roleName: "finance" },
    { sortOrder: 2, approverType: "role", roleName: "direktur-operational" },
    { sortOrder: 3, approverType: "role", roleName: "operational" },
  ],
  decoration: [
    { sortOrder: 1, approverType: "role", roleName: "finance" },
    { sortOrder: 2, approverType: "role", roleName: "direktur-operational" },
    { sortOrder: 3, approverType: "role", roleName: "operational" },
  ],
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
  if (!flowDef || flowDef.length === 0) return null;

  const roleNames = flowDef.map((s) => s.roleName);
  const roles = await db.role.findMany({
    where: { name: { in: roleNames } },
    select: { id: true, name: true },
  });

  const roleMap = new Map(roles.map((r) => [r.name, r.id]));

  const resolved: ResolvedStep[] = [];
  for (const step of flowDef) {
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
