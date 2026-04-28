import { prisma } from "./_client";

export async function seedPackages() {
  const venues = await prisma.venue.findMany({ select: { id: true, code: true } });
  const venueByCode = Object.fromEntries(venues.map((v) => [v.code, v.id]));

  const packageData: { packageName: string; venueCode: string; variants: { variantName: string; pax: number; price: number }[] }[] = [
    { packageName: "PARAMA PAKUBUWONO", venueCode: "PKP", variants: [{ variantName: "600 pax", pax: 600, price: 271000000 }, { variantName: "800 pax", pax: 800, price: 320000000 }] },
    { packageName: "KUSUMA PAKUBUWONO", venueCode: "PKP", variants: [{ variantName: "600 pax", pax: 600, price: 325000000 }, { variantName: "800 pax", pax: 800, price: 368000000 }] },
    { packageName: "CHROMA PACKAGE", venueCode: "PKP", variants: [{ variantName: "800 Pax", pax: 800, price: 158800000 }] },
    { packageName: "SUNDARI SOPO DEL SAMISARA", venueCode: "GSS", variants: [{ variantName: "600 pax", pax: 600, price: 325000000 }, { variantName: "800 pax", pax: 800, price: 372000000 }] },
    { packageName: "JAYANTI SOPO DEL SAMISARA", venueCode: "GSS", variants: [{ variantName: "600 pax", pax: 600, price: 355000000 }, { variantName: "800 pax", pax: 800, price: 420000000 }] },
    { packageName: "SUNDARI MENARA BRIPENS", venueCode: "GMP", variants: [{ variantName: "600 pax", pax: 600, price: 299800000 }, { variantName: "800 pax", pax: 800, price: 329800000 }] },
    { packageName: "VELORA PACKAGE", venueCode: "GMP", variants: [{ variantName: "800 Pax", pax: 800, price: 329800000 }] },
    { packageName: "CHROMA PACKAGE", venueCode: "GMP", variants: [{ variantName: "800 Pax", pax: 800, price: 299800000 }] },
    { packageName: "CHROMA PACKAGE", venueCode: "SBT", variants: [{ variantName: "800 Pax", pax: 800, price: 279800000 }] },
    { packageName: "VELORA PACKAGE", venueCode: "SBT", variants: [{ variantName: "800 Pax", pax: 800, price: 309800000 }] },
    { packageName: "CHROMA PACKAGE", venueCode: "SBG", variants: [{ variantName: "800 Pax", pax: 800, price: 269800000 }] },
    { packageName: "VELORA BRIN GATSU", venueCode: "SBG", variants: [{ variantName: "800 Pax", pax: 800, price: 299800000 }] },
    { packageName: "CRHOMA BRIN GATSU", venueCode: "SBG", variants: [{ variantName: "800 Pax", pax: 800, price: 269800000 }] },
    { packageName: "BRIN GATOT PROMO", venueCode: "SBG", variants: [{ variantName: "Chroma Package", pax: 800, price: 269800000 }, { variantName: "Velora Package", pax: 800, price: 299800000 }] },
    { packageName: "CHROMA PACKAGE", venueCode: "SSK", variants: [{ variantName: "800 Pax", pax: 800, price: 319800000 }] },
    { packageName: "VELORA PACKAGE", venueCode: "SSK", variants: [{ variantName: "800 Pax", pax: 800, price: 349800000 }] },
    { packageName: "CHROMA PACKAGE", venueCode: "SDG", variants: [{ variantName: "800 Pax", pax: 800, price: 229800000 }] },
    { packageName: "VELORA PACKAGE", venueCode: "SDG", variants: [{ variantName: "1000 Pax", pax: 1000, price: 318800000 }] },
    { packageName: "AURORA PACKAGE", venueCode: "SDG", variants: [{ variantName: "1000", pax: 1000, price: 358800000 }, { variantName: "Paket 2 ", pax: 600, price: 150000000 }, { variantName: "Paket 3", pax: 300, price: 100000000 }] },
    { packageName: "CHROMA PACKAGE", venueCode: "SLK", variants: [{ variantName: "1000 Pax", pax: 1000, price: 268800000 }] },
  ];

  for (const pkg of packageData) {
    const venueId = venueByCode[pkg.venueCode];
    if (!venueId) { console.warn(`⚠️  Venue ${pkg.venueCode} not found, skipping ${pkg.packageName}`); continue; }

    const existing = await prisma.package.findFirst({ where: { packageName: pkg.packageName, venueId } });
    if (existing) continue;

    const created = await prisma.package.create({ data: { packageName: pkg.packageName, available: true, venueId, notes: "" } });
    for (const v of pkg.variants) {
      const variant = await prisma.packageVariant.create({ data: { packageId: created.id, variantName: v.variantName, pax: v.pax, available: true } });
      // Store price in separate package_variant_category_prices table
      if (v.price && v.price > 0) {
        await prisma.package_variant_category_prices.create({
          data: {
            id: `pvcp-${variant.id}-${Date.now()}`,
            packageVariantId: variant.id,
            categoryName: "Base Price",
            basePrice: v.price,
            updatedAt: new Date(),
          },
        });
      }
    }
  }

  console.log(`✅ ${packageData.length} Packages with variants seeded`);
}

// Run standalone
if (process.argv[1].includes("packages")) {
  seedPackages()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
