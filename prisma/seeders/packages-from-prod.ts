import { readFileSync } from "fs";
import { join } from "path";
import { prisma } from "./_client";
import { resolveApprovalSteps } from "../../lib/approval-flows";

// ─── Types for prod export JSON ──────────────────────────────────────────────

interface ProdCategoryPrice {
  id: string;
  packageVariantId: string;
  categoryName: string;
  basePrice: number;
  sortOrder: number;
  isShow: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProdInternalItem {
  id: string;
  packageVariantId: string;
  itemName: string;
  itemDescription: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface ProdVendorItem {
  id: string;
  packageVariantId: string;
  categoryName: string;
  itemText: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface ProdVariant {
  id: string;
  packageId: string;
  variantName: string;
  pax: number;
  available: boolean;
  margin: number;
  termAndCondition: string | null;
  sellingPrice: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  categoryPrices: ProdCategoryPrice[];
  internalItems: ProdInternalItem[];
  vendorItems: ProdVendorItem[];
}

interface ProdVenue {
  id: string;
  name: string;
  code: string;
}

interface ProdPackage {
  id: string;
  packageName: string;
  available: boolean;
  venueId: string;
  notes: string | null;
  approvalStatus: string;
  createdAt: string;
  updatedAt: string;
  venue: ProdVenue;
  variants: ProdVariant[];
}

interface ProdExport {
  exportedFromHost: string;
  counts: {
    packages: number;
    variants: number;
    categoryPrices: number;
    internalItems: number;
    vendorItems: number;
    venues: number;
  };
  venues: ProdVenue[];
  packages: ProdPackage[];
}

// Shape of venue rows fetched from target DB
interface TargetVenue {
  id: string;
  code: string;
  name: string;
}

// ─── Seeder ───────────────────────────────────────────────────────────────────

export async function seedPackagesFromProd(): Promise<void> {
  // Load prod export
  const exportPath = join(process.cwd(), "scripts", "exports", "prod-packages-export.json");
  const raw = readFileSync(exportPath, "utf-8");
  const data = JSON.parse(raw) as ProdExport;

  // 1. Truncate approval records for packages (steps cascade from records via onDelete: Cascade)
  const { count: approvalSteps } = await prisma.approvalRecordStep.deleteMany({
    where: { record: { module: { in: ["package", "booking"] } } },
  });
  const { count: approvalRecords } = await prisma.approvalRecord.deleteMany({
    where: { module: { in: ["package", "booking"] } },
  });
  console.error(`Deleted ${approvalRecords} approval records, ${approvalSteps} steps`);

  // Delete all packages (cascade: vendorItems, internalItems, categoryPrices via onDelete: Cascade)
  await prisma.package.deleteMany({});
  console.error("All packages deleted");

  // 2. Get creator profile (sales@swasana.com) — same as existing seeder
  const salesUser = await prisma.user.findUnique({ where: { email: "sales@swasana.com" } });
  const salesProfile = salesUser
    ? await prisma.profile.findUnique({ where: { userId: salesUser.id } })
    : null;

  const adminUser = await prisma.user.findUnique({ where: { email: "admin@swasana.com" } });
  const adminProfile = adminUser
    ? await prisma.profile.findUnique({ where: { userId: adminUser.id } })
    : null;

  // 3. Get hardcoded approval flow for package (Manager → Finance)
  const flow = await resolveApprovalSteps("package");

  // 4. Build venue lookup map from TARGET database (resolve by code/name, not raw prod ID)
  const targetVenues: TargetVenue[] = await prisma.venue.findMany({
    select: { id: true, code: true, name: true },
  });

  const venueByCode = new Map<string, TargetVenue>();
  const venueByName = new Map<string, TargetVenue>();
  for (const v of targetVenues) {
    venueByCode.set(v.code.toLowerCase().trim(), v);
    venueByName.set(v.name.toLowerCase().trim(), v);
  }

  // 5. Build flat list: one entry per active variant
  let count = 0;
  let skipped = 0;

  for (const pkg of data.packages) {
    // Resolve venue in TARGET db via code (primary) then name (fallback)
    const prodCode = pkg.venue.code.toLowerCase().trim();
    const prodName = pkg.venue.name.toLowerCase().trim();
    const targetVenue = venueByCode.get(prodCode) ?? venueByName.get(prodName);

    if (!targetVenue) {
      const activeVariants = pkg.variants.filter((v) => v.deletedAt === null);
      skipped += activeVariants.length;
      console.warn(
        `[SKIP] Package "${pkg.packageName}" — venue not found in target DB ` +
          `(code: "${pkg.venue.code}", name: "${pkg.venue.name}"). ` +
          `Skipping ${activeVariants.length} variant(s).`,
      );
      continue;
    }

    for (const variant of pkg.variants) {
      // Skip soft-deleted variants
      if (variant.deletedAt !== null) continue;

      // Flat packageName = variant name only (e.g. "GOLD", "SAPPHIRE")
      const flatName = variant.variantName;

      const created = await prisma.package.create({
        data: {
          packageName: flatName,
          available: variant.available,
          venueId: targetVenue.id,
          notes: pkg.notes ?? "",
          pax: variant.pax,
          margin: variant.margin,
          sellingPrice: variant.sellingPrice,
          termAndCondition: variant.termAndCondition ?? null,
          approvalStatus: adminProfile ? "approved" : "pending",
        },
      });

      // Vendor items
      for (let i = 0; i < variant.vendorItems.length; i++) {
        const vi = variant.vendorItems[i];
        await prisma.packageVendorItem.create({
          data: {
            packageId: created.id,
            categoryName: vi.categoryName,
            itemText: vi.itemText,
            sortOrder: vi.sortOrder,
          },
        });
      }

      // Internal items
      for (let i = 0; i < variant.internalItems.length; i++) {
        const ii = variant.internalItems[i];
        await prisma.packageInternalItem.create({
          data: {
            packageId: created.id,
            itemName: ii.itemName,
            itemDescription: ii.itemDescription,
            sortOrder: ii.sortOrder,
          },
        });
      }

      // Category prices
      for (let i = 0; i < variant.categoryPrices.length; i++) {
        const cp = variant.categoryPrices[i];
        await prisma.packageCategoryPrice.create({
          data: {
            packageId: created.id,
            categoryName: cp.categoryName,
            basePrice: cp.basePrice,
            sortOrder: cp.sortOrder,
            isShow: cp.isShow,
          },
        });
      }

      // Approval record — mirror existing seeder pattern
      if (flow && flow.length > 0 && salesProfile) {
        const approver = adminProfile ?? salesProfile;
        const record = await prisma.approvalRecord.create({
          data: {
            module: "package",
            entityId: created.id,
            status: adminProfile ? "approved" : "pending",
            createdById: salesProfile.id,
          },
        });

        for (const step of flow) {
          await prisma.approvalRecordStep.create({
            data: {
              recordId: record.id,
              stepOrder: step.sortOrder,
              approverType: step.approverType,
              approverRoleId: step.approverRoleId,
              approverUserId: null,
              status: "approved",
              decidedById: approver.id,
              decidedAt: new Date(),
            },
          });
        }
      }

      count++;
    }
  }

  const skipMsg = skipped > 0 ? `, ${skipped} skipped (venue not found in target DB)` : "";
  console.error(`${count} flat packages seeded from prod export (variant -> flat mapping)${skipMsg}`);
}

// ─── Standalone runner ────────────────────────────────────────────────────────

if (process.argv[1].includes("packages-from-prod")) {
  seedPackagesFromProd()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
