/*
  Warnings:

  - You are about to drop the `approval_flow_steps` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `approval_flows` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey (idempotent — safe across environments)
ALTER TABLE IF EXISTS "approval_flow_steps" DROP CONSTRAINT IF EXISTS "approval_flow_steps_approverRoleId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "approval_flow_steps" DROP CONSTRAINT IF EXISTS "approval_flow_steps_approverUserId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "approval_flow_steps" DROP CONSTRAINT IF EXISTS "approval_flow_steps_flowId_fkey";

-- DropTable
DROP TABLE IF EXISTS "approval_flow_steps";

-- DropTable
DROP TABLE IF EXISTS "approval_flows";
