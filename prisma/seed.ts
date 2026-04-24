import { seedRolesPermissions } from "./seeders/roles-permissions";
import { seedReferenceData } from "./seeders/reference-data";
import { seedBrandsVenues } from "./seeders/brands-venues";
import { seedPackages } from "./seeders/packages";
import { seedVendors } from "./seeders/vendors";
import { seedUsers } from "./seeders/users";
import { seedGroups } from "./seeders/groups";
import { seedOrderStatuses } from "./seeders/order-statuses";
import { prisma } from "./seeders/_client";

async function main() {
  console.log("🌱 Seeding database...\n"); 

  await seedRolesPermissions();
  await seedReferenceData();
  await seedBrandsVenues();
  await seedPackages();
  await seedVendors();
  await seedUsers();
  await seedGroups();
  await seedOrderStatuses();

  console.log("\n🎉 Seeding completed!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
