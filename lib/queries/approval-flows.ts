import { db } from "@/lib/db";

const approvalFlowInclude = {
  steps: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      approverRole: { select: { id: true, name: true } },
      approverUser: { select: { id: true, fullName: true } },
    },
  },
} as const;

export async function getApprovalFlows() {
  return db.approvalFlow.findMany({
    orderBy: { createdAt: "asc" },
    include: approvalFlowInclude,
  });
}

export type ApprovalFlowsResult = Awaited<ReturnType<typeof getApprovalFlows>>;
export type ApprovalFlowItem = ApprovalFlowsResult[number];
