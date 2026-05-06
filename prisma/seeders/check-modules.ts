import { prisma } from "./_client";

async function main() {
  const mods = await prisma.permission.findMany({
    select: { module: true },
    distinct: ["module"],
    orderBy: { module: "asc" },
  });
  console.error("=== Modules in DB ===");
  console.error(mods.map(m => m.module).join("\n"));
  console.error(`Total: ${mods.length} modules`);
}
main().finally(() => prisma.$disconnect());
