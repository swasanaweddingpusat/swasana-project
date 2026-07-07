-- Migration: add_approval_flow_config_and_top_ack
-- Creates DB-driven approval flow config tables (ApprovalFlowConfig + ApprovalFlowStep)
-- and adds acknowledgment fields to term_of_payments.
-- Idempotent — safe to run multiple times.

-- ── 1. Create approval_flow_configs ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "approval_flow_configs" (
    "id"         TEXT NOT NULL,
    "module"     TEXT NOT NULL,
    "label"      TEXT,
    "sequential" BOOLEAN NOT NULL DEFAULT false,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approval_flow_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "approval_flow_configs_module_key"
    ON "approval_flow_configs"("module");

-- ── 2. Drop old approval_flow_steps (different schema from 20260427 migration)
DROP TABLE IF EXISTS "approval_flow_steps" CASCADE;

-- Create approval_flow_steps
CREATE TABLE "approval_flow_steps" (
    "id"             TEXT NOT NULL,
    "flowId"         TEXT NOT NULL,
    "stepOrder"      INTEGER NOT NULL,
    "approverRoleId" TEXT NOT NULL,
    "label"          TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approval_flow_steps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "approval_flow_steps_flowId_stepOrder_key"
    ON "approval_flow_steps"("flowId", "stepOrder");

CREATE INDEX IF NOT EXISTS "approval_flow_steps_flowId_idx"
    ON "approval_flow_steps"("flowId");

CREATE INDEX IF NOT EXISTS "approval_flow_steps_approverRoleId_idx"
    ON "approval_flow_steps"("approverRoleId");

-- FK: flow → config (CASCADE on delete)
ALTER TABLE "approval_flow_steps"
    DROP CONSTRAINT IF EXISTS "approval_flow_steps_flowId_fkey";
ALTER TABLE "approval_flow_steps"
    ADD CONSTRAINT "approval_flow_steps_flowId_fkey"
    FOREIGN KEY ("flowId") REFERENCES "approval_flow_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FK: step → role (RESTRICT — don't allow deleting a role that's still referenced)
ALTER TABLE "approval_flow_steps"
    DROP CONSTRAINT IF EXISTS "approval_flow_steps_approverRoleId_fkey";
ALTER TABLE "approval_flow_steps"
    ADD CONSTRAINT "approval_flow_steps_approverRoleId_fkey"
    FOREIGN KEY ("approverRoleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 3. Add acknowledgment fields to term_of_payments ─────────────────────────
ALTER TABLE "term_of_payments"
    ADD COLUMN IF NOT EXISTS "ackStatus"        TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS "acknowledgedAt"   TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "acknowledgedById" TEXT;

CREATE INDEX IF NOT EXISTS "term_of_payments_acknowledgedById_idx"
    ON "term_of_payments"("acknowledgedById");

-- FK: acknowledgedById → profiles
ALTER TABLE "term_of_payments"
    DROP CONSTRAINT IF EXISTS "term_of_payments_acknowledgedById_fkey";
ALTER TABLE "term_of_payments"
    ADD CONSTRAINT "term_of_payments_acknowledgedById_fkey"
    FOREIGN KEY ("acknowledgedById") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 4. Seed approval flow config — mirrors APPROVAL_FLOWS in lib/approval-flows.ts ─
-- Uses gen_random_uuid() for IDs; ON CONFLICT DO NOTHING ensures idempotency.

-- booking flow (non-sequential: manager → finance)
INSERT INTO "approval_flow_configs" ("id", "module", "label", "sequential", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'booking', 'Booking Approval', false, now(), now())
ON CONFLICT ("module") DO NOTHING;

-- package flow (non-sequential: manager → finance)
INSERT INTO "approval_flow_configs" ("id", "module", "label", "sequential", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'package', 'Package Approval', false, now(), now())
ON CONFLICT ("module") DO NOTHING;

-- quotations flow (non-sequential: manager → finance)
INSERT INTO "approval_flow_configs" ("id", "module", "label", "sequential", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'quotations', 'Quotation Approval', false, now(), now())
ON CONFLICT ("module") DO NOTHING;

-- catering flow (sequential: finance → direktur-operational → operational)
INSERT INTO "approval_flow_configs" ("id", "module", "label", "sequential", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'catering', 'Catering Approval', true, now(), now())
ON CONFLICT ("module") DO NOTHING;

-- decoration flow (sequential: finance → direktur-operational → operational)
INSERT INTO "approval_flow_configs" ("id", "module", "label", "sequential", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'decoration', 'Decoration Approval', true, now(), now())
ON CONFLICT ("module") DO NOTHING;

-- payment flow (single-step, non-sequential: finance acks TOP)
INSERT INTO "approval_flow_configs" ("id", "module", "label", "sequential", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'payment', 'Payment Acknowledgment', false, now(), now())
ON CONFLICT ("module") DO NOTHING;

-- ── 5. Seed approval flow steps ───────────────────────────────────────────────
-- booking steps: step 1 = manager, step 2 = finance
INSERT INTO "approval_flow_steps" ("id", "flowId", "stepOrder", "approverRoleId", "label", "createdAt", "updatedAt")
SELECT gen_random_uuid(), c.id, 1, r.id, 'Manager', now(), now()
FROM "approval_flow_configs" c
JOIN "roles" r ON r.name = 'manager'
WHERE c.module = 'booking'
ON CONFLICT ("flowId", "stepOrder") DO NOTHING;

INSERT INTO "approval_flow_steps" ("id", "flowId", "stepOrder", "approverRoleId", "label", "createdAt", "updatedAt")
SELECT gen_random_uuid(), c.id, 2, r.id, 'Finance', now(), now()
FROM "approval_flow_configs" c
JOIN "roles" r ON r.name = 'finance'
WHERE c.module = 'booking'
ON CONFLICT ("flowId", "stepOrder") DO NOTHING;

-- package steps: step 1 = manager, step 2 = finance
INSERT INTO "approval_flow_steps" ("id", "flowId", "stepOrder", "approverRoleId", "label", "createdAt", "updatedAt")
SELECT gen_random_uuid(), c.id, 1, r.id, 'Manager', now(), now()
FROM "approval_flow_configs" c
JOIN "roles" r ON r.name = 'manager'
WHERE c.module = 'package'
ON CONFLICT ("flowId", "stepOrder") DO NOTHING;

INSERT INTO "approval_flow_steps" ("id", "flowId", "stepOrder", "approverRoleId", "label", "createdAt", "updatedAt")
SELECT gen_random_uuid(), c.id, 2, r.id, 'Finance', now(), now()
FROM "approval_flow_configs" c
JOIN "roles" r ON r.name = 'finance'
WHERE c.module = 'package'
ON CONFLICT ("flowId", "stepOrder") DO NOTHING;

-- quotations steps: step 1 = manager, step 2 = finance
INSERT INTO "approval_flow_steps" ("id", "flowId", "stepOrder", "approverRoleId", "label", "createdAt", "updatedAt")
SELECT gen_random_uuid(), c.id, 1, r.id, 'Manager', now(), now()
FROM "approval_flow_configs" c
JOIN "roles" r ON r.name = 'manager'
WHERE c.module = 'quotations'
ON CONFLICT ("flowId", "stepOrder") DO NOTHING;

INSERT INTO "approval_flow_steps" ("id", "flowId", "stepOrder", "approverRoleId", "label", "createdAt", "updatedAt")
SELECT gen_random_uuid(), c.id, 2, r.id, 'Finance', now(), now()
FROM "approval_flow_configs" c
JOIN "roles" r ON r.name = 'finance'
WHERE c.module = 'quotations'
ON CONFLICT ("flowId", "stepOrder") DO NOTHING;

-- catering steps: step 1 = finance, step 2 = direktur-operational, step 3 = operational
INSERT INTO "approval_flow_steps" ("id", "flowId", "stepOrder", "approverRoleId", "label", "createdAt", "updatedAt")
SELECT gen_random_uuid(), c.id, 1, r.id, 'Finance', now(), now()
FROM "approval_flow_configs" c
JOIN "roles" r ON r.name = 'finance'
WHERE c.module = 'catering'
ON CONFLICT ("flowId", "stepOrder") DO NOTHING;

INSERT INTO "approval_flow_steps" ("id", "flowId", "stepOrder", "approverRoleId", "label", "createdAt", "updatedAt")
SELECT gen_random_uuid(), c.id, 2, r.id, 'Direktur Operational', now(), now()
FROM "approval_flow_configs" c
JOIN "roles" r ON r.name = 'direktur-operational'
WHERE c.module = 'catering'
ON CONFLICT ("flowId", "stepOrder") DO NOTHING;

INSERT INTO "approval_flow_steps" ("id", "flowId", "stepOrder", "approverRoleId", "label", "createdAt", "updatedAt")
SELECT gen_random_uuid(), c.id, 3, r.id, 'Operational', now(), now()
FROM "approval_flow_configs" c
JOIN "roles" r ON r.name = 'operational'
WHERE c.module = 'catering'
ON CONFLICT ("flowId", "stepOrder") DO NOTHING;

-- decoration steps: step 1 = finance, step 2 = direktur-operational, step 3 = operational
INSERT INTO "approval_flow_steps" ("id", "flowId", "stepOrder", "approverRoleId", "label", "createdAt", "updatedAt")
SELECT gen_random_uuid(), c.id, 1, r.id, 'Finance', now(), now()
FROM "approval_flow_configs" c
JOIN "roles" r ON r.name = 'finance'
WHERE c.module = 'decoration'
ON CONFLICT ("flowId", "stepOrder") DO NOTHING;

INSERT INTO "approval_flow_steps" ("id", "flowId", "stepOrder", "approverRoleId", "label", "createdAt", "updatedAt")
SELECT gen_random_uuid(), c.id, 2, r.id, 'Direktur Operational', now(), now()
FROM "approval_flow_configs" c
JOIN "roles" r ON r.name = 'direktur-operational'
WHERE c.module = 'decoration'
ON CONFLICT ("flowId", "stepOrder") DO NOTHING;

INSERT INTO "approval_flow_steps" ("id", "flowId", "stepOrder", "approverRoleId", "label", "createdAt", "updatedAt")
SELECT gen_random_uuid(), c.id, 3, r.id, 'Operational', now(), now()
FROM "approval_flow_configs" c
JOIN "roles" r ON r.name = 'operational'
WHERE c.module = 'decoration'
ON CONFLICT ("flowId", "stepOrder") DO NOTHING;

-- payment step: single step = finance
INSERT INTO "approval_flow_steps" ("id", "flowId", "stepOrder", "approverRoleId", "label", "createdAt", "updatedAt")
SELECT gen_random_uuid(), c.id, 1, r.id, 'Finance', now(), now()
FROM "approval_flow_configs" c
JOIN "roles" r ON r.name = 'finance'
WHERE c.module = 'payment'
ON CONFLICT ("flowId", "stepOrder") DO NOTHING;

-- ── 6. Add finance-ar permissions for ack action (idempotent) ────────────────
-- Reuse existing finance-ar module; "ack" maps to "edit" permission
-- (no new permission needed — acknowledgePayment is gated by finance-ar:edit)
