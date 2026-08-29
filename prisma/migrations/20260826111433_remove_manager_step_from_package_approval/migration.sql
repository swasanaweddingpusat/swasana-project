-- Migration: remove_manager_step_from_package_approval
-- Package Wedding (module "package") approval flow: drop the "manager" step,
-- leaving "finance" as the only approval level. Package MICE (module
-- "package-mice") and Booking (module "booking") are untouched.
-- Idempotent — safe to run multiple times.

-- ── 1. Remove the manager step from the package approval flow ───────────────
DELETE FROM "approval_flow_steps" aps
USING "approval_flow_configs" c, "roles" r
WHERE aps."flowId" = c.id
  AND aps."approverRoleId" = r.id
  AND c.module = 'package'
  AND r.name = 'manager';

-- ── 2. Renumber the remaining finance step to stepOrder 1 ────────────────────
UPDATE "approval_flow_steps" aps
SET "stepOrder" = 1
FROM "approval_flow_configs" c, "roles" r
WHERE aps."flowId" = c.id
  AND aps."approverRoleId" = r.id
  AND c.module = 'package'
  AND r.name = 'finance'
  AND aps."stepOrder" <> 1;

-- ── 3. Insert the finance step if the package flow ended up with none at all
-- (covers envs where the flow row exists but was never seeded with steps —
-- resolveApprovalSteps() falls back to the hardcoded constant in that case,
-- but the Settings UI reads DB steps directly, so keep them in sync here).
INSERT INTO "approval_flow_steps" ("id", "flowId", "stepOrder", "approverRoleId", "label", "createdAt", "updatedAt")
SELECT gen_random_uuid(), c.id, 1, r.id, 'Finance', now(), now()
FROM "approval_flow_configs" c
JOIN "roles" r ON r.name = 'finance'
WHERE c.module = 'package'
  AND NOT EXISTS (
    SELECT 1 FROM "approval_flow_steps" s2 WHERE s2."flowId" = c.id
  )
ON CONFLICT ("flowId", "stepOrder") DO NOTHING;
