import { prisma } from "./_client";

const FLOWS = [
  {
    module: "package",
    name: "Approval Package",
    steps: [
      { sortOrder: 1, roleName: "sales" },
      { sortOrder: 2, roleName: "manager" },
      { sortOrder: 3, roleName: "finance" },
    ],
  },
  {
    module: "booking",
    name: "Approval Booking",
    steps: [
      { sortOrder: 1, roleName: "sales" },
      { sortOrder: 2, roleName: "manager" },
      { sortOrder: 3, approverType: "client" as const },
    ],
  },
];

export async function seedApprovalFlows(reset = false) {
  if (reset) {
    await prisma.approvalFlowStep.deleteMany();
    await prisma.approvalFlow.deleteMany();
    console.log("🗑️  All approval flows deleted");
  }

  for (const flow of FLOWS) {
    const existing = await prisma.approvalFlow.findUnique({ where: { module: flow.module } });
    if (existing) {
      console.log(`⏭️  Flow "${flow.module}" already exists, skipping`);
      continue;
    }

    // Create flow first (no nested create to avoid transaction)
    const created = await prisma.approvalFlow.create({
      data: { module: flow.module, name: flow.name, active: true },
    });

    // Create steps one by one
    for (const step of flow.steps) {
      if ("approverType" in step && step.approverType === "client") {
        await prisma.approvalFlowStep.create({
          data: { flowId: created.id, sortOrder: step.sortOrder, approverType: "client", approverRoleId: null, approverUserId: null },
        });
      } else if ("roleName" in step) {
        const role = await prisma.role.findUnique({ where: { name: step.roleName } });
        if (!role) { console.error(`❌ Role "${step.roleName}" not found`); return; }
        await prisma.approvalFlowStep.create({
          data: { flowId: created.id, sortOrder: step.sortOrder, approverType: "role", approverRoleId: role.id },
        });
      }
    }

    console.log(`✅ Flow "${flow.name}" seeded with ${flow.steps.length} steps`);
  }
}

// Run standalone
if (process.argv[1].includes("approval-flows")) {
  const reset = process.argv.includes("--reset");
  seedApprovalFlows(reset)
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
