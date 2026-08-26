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
  // Single-step: Package Wedding approval is Finance only (manager step removed).
  package: {
    steps: [
      { sortOrder: 1, approverType: "role", roleName: "finance" },
    ],
  },
  // Single-step: only manager-mice/super-admin can approve MICE packages;
  // finance is intentionally NOT in this flow since it can't see the menu.
  "package-mice": {
    steps: [
      { sortOrder: 1, approverType: "role", roleName: "manager-mice" },
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

/** A fully-resolved approval step ready to be persisted as an ApprovalRecordStep row. */
export interface BuiltApprovalStep {
  stepOrder: number;
  approverType: "role" | "user" | "client";
  approverRoleId: string | null;
  approverUserId: string | null;
  status: "pending" | "approved";
  decidedById: string | null;
  decidedAt: Date | null;
  signature: string | null;
}

/**
 * Builds the approval steps for a booking (wedding or MICE).
 *
 * Shape: a conditional Sales step (stepOrder 0, approverType "user") followed by
 * the role steps from the resolved flow (manager → finance), all shifted to keep
 * their original order after the sales step.
 *
 * Auto-approve rules:
 * - Sales step: approved (with signature) ONLY when the creator IS the assigned
 *   sales person AND a signature was captured in the wizard. Otherwise pending —
 *   the assigned sales must sign later via the approval page.
 * - Role steps (manager, finance): ALWAYS pending. No creator-based auto-approve.
 *
 * Returns null when no flow is resolvable (same contract as resolveApprovalSteps).
 */
export async function buildBookingApprovalSteps(opts: {
  salesId: string | null | undefined;
  creatorProfileId: string;
  signatureSales: string | null | undefined;
  decidedAt: Date;
  /** Whether to append a client-TTD step at the end. True for Wedding, false for MICE. Default: true. */
  includeClientStep?: boolean;
}): Promise<BuiltApprovalStep[] | null> {
  const roleSteps = await resolveApprovalSteps("booking");
  if (!roleSteps || roleSteps.length === 0) return null;

  const steps: BuiltApprovalStep[] = [];

  // Conditional Sales step at the front (stepOrder 0).
  if (opts.salesId) {
    const selfSign =
      opts.creatorProfileId === opts.salesId && !!opts.signatureSales;
    steps.push({
      stepOrder: 0,
      approverType: "user",
      approverRoleId: null,
      approverUserId: opts.salesId,
      status: selfSign ? "approved" : "pending",
      decidedById: selfSign ? opts.salesId : null,
      decidedAt: selfSign ? opts.decidedAt : null,
      signature: selfSign ? (opts.signatureSales ?? null) : null,
    });
  }

  // Role steps (manager, finance) — always pending.
  for (const s of roleSteps) {
    steps.push({
      stepOrder: s.sortOrder,
      approverType: "role",
      approverRoleId: s.approverRoleId,
      approverUserId: null,
      status: "pending",
      decidedById: null,
      decidedAt: null,
      signature: null,
    });
  }

  // Client step — Wedding only. Always last, always pending. Never auto-approved.
  // stepOrder = max stepOrder so far + 1.
  const includeClient = opts.includeClientStep !== false;
  if (includeClient) {
    const maxStepOrder = steps.reduce((max, s) => Math.max(max, s.stepOrder), 0);
    steps.push({
      stepOrder: maxStepOrder + 1,
      approverType: "client",
      approverRoleId: null,
      approverUserId: null,
      status: "pending",
      decidedById: null,
      decidedAt: null,
      signature: null,
    });
  }

  return steps;
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
