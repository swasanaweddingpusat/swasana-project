
import { seedRolesPermissions } from "./seeders/roles-permissions";
import { seedReferenceData } from "./seeders/reference-data";
import { seedBrandsVenues } from "./seeders/brands-venues";
import { seedPackages } from "./seeders/packages";
import { seedMicePackages } from "./seeders/packages-mice";
import { seedVendors } from "./seeders/vendors";
import { seedUsers } from "./seeders/users";
import { seedGroups } from "./seeders/groups";
import { seedOrderStatuses } from "./seeders/order-statuses";
import { seedEventTypes } from "./seeders/event-types";
import { seedQuotationTemplates, seedBripensQuotationTemplate, seedPatrajasaQuotationTemplate, seedLippoQuotationTemplate, seedParamitaQuotationTemplate } from "./seeders/quotation-templates";
import { prisma } from "./seeders/_client";

async function main() {
  console.log("🌱 Seeding database...\n");

  await seedRolesPermissions();
  await seedReferenceData();
  await seedBrandsVenues();
  await seedPackages();
  await seedMicePackages();
  await seedVendors();
  await seedUsers();
  await seedGroups();
  await seedOrderStatuses();
  await seedEventTypes();
  await seedQuotationTemplates();
  await seedBripensQuotationTemplate();
  await seedPatrajasaQuotationTemplate();
  await seedLippoQuotationTemplate();
  await seedParamitaQuotationTemplate();

  console.log("\n🎉 Seeding completed!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
