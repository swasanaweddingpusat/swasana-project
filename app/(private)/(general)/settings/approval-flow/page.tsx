import { requirePagePermission } from "@/lib/require-page-permission";
import { getAllApprovalFlows } from "@/lib/queries/approvalFlow";
import { db } from "@/lib/db";
import { ApprovalFlowSettings } from "./_components/ApprovalFlowSettings";

export default async function ApprovalFlowPage(): Promise<React.ReactElement> {
  await requirePagePermission(["settings-role-permission"]);

  const [flows, roles] = await Promise.all([
    getAllApprovalFlows(),
    db.role.findMany({
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <div className="px-6 pb-6 space-y-6">
      <ApprovalFlowSettings flows={flows} roles={roles} />
    </div>
  );
}
