import { requirePagePermission } from "@/lib/require-page-permission";
import { ApprovalFlowManager } from "./_components/approval-flow-manager";

export default async function ApprovalFlowPage() {
  await requirePagePermission("settings-approval-flow");
  return <ApprovalFlowManager />;
}
