import { prisma } from "./_client";

/**
 * MICE package seeder — one representative (most complete) quotation template
 * per venue, derived from the "RECAP DEALING MICE EVENT KEDIAMAN" spreadsheet.
 *
 * Each quotation section (Ballroom Facilities / Equipments / F&B / Complimentary…)
 * becomes ONE PackageMiceItem: section label → itemName, its bullet lines →
 * itemDescription. "Additional"/"Others"/"Charge" sections were intentionally
 * skipped.
 *
 * Pricing (categoryPrices / sellingPrice) is deliberately NOT seeded — MICE
 * "Harga Jual" is set later via the "Set Harga" drawer, exactly like the wedding
 * seeder leaves sellingPrice: 0. This seeder only fills the descriptive items.
 *
 * ADDITIVE + idempotent: skips entirely if any MICE package already exists, and
 * skips per-venue if that venue already has a MICE package. Never deletes.
 */

type MiceItemSeed = {
  itemName: string;
  itemDescription: string;
};

type MicePackageSeed = {
  venueCode: string;
  packageName: string;
  items: MiceItemSeed[];
};

export const MICE_TEMPLATES: MicePackageSeed[] = [
  {
    venueCode: "SAMISARA",
    packageName: "MICE Package - Samisara",
    items: [
      {
        itemName: "Ballroom Facilities",
        itemDescription:
          "Full Carpet Ballroom\nFull Air Conditioned\nVoyager Area\nExclusive Restroom\nParking area lot up to 800\nCleaning Service\nElectricity 10.000 watt\nSecurity",
      },
      {
        itemName: "Equipments",
        itemDescription:
          "Main Stage\nMusic Stage\n200 Banquet Chairs\n20 Roundtable D120 + Cover (Black)\n4 Registration Table\nLED Videotron 4x3\nSoundsystem Standart 1000 Watt (2 Mic)",
      },
      {
        itemName: "Food and Beverages Full Day Package (1x Buffet, 2x Coffee Break)",
        itemDescription:
          "Buffet Package Includes:\nNasi Putih\nAyam (Pilihan)\nDaging (Pilihan)\nIkan (Pilihan)\nSayur (Pilihan)\nKerupuk\nSambal\nBuah Potong\nAir Mineral (Free Flow)\nLemon Tea/Lychee Tea\nCoffee Break Package Includes:\nCoffee\nTea\n3 Snack Selections (Sweet & Savory)",
      },
      {
        itemName: "Complimentary",
        itemDescription:
          "Free 3 Holding Room (Artia,Anggara,Ringkar)\nFree VIP Room (Sortali & Tahuluk)\nFree 250 Banquet Chairs\nFree Cover Banquet Chairs\nFree 30 IBM Table",
      },
    ],
  },
  {
    venueCode: "BRIPENS",
    packageName: "MICE Package - Menara Bripens",
    items: [
      {
        itemName: "Ballroom Facilities",
        itemDescription:
          "Menara Bripens Grand Ballroom for 6 hours\nFull Carpet Ballroom\nFull Air Conditioned\nExclusive Chandeliers\n8-meter High Ceiling\n2 Changing Rooms\n1 Holding Room\nExclusive Restroom\nPrayer Room\nParking area lot up to 800\nCleaning Service\nElectricity 10.000 watt\nSecurity",
      },
      {
        itemName: "Equipments",
        itemDescription:
          "Main Stage\nMusic Stage\n100 Tiffany Chairs\n20 Roundtable D120 + Cover (Black)\n4 Registration Table + Cover (Black)\nLED Videotron 2,5 x 5 m\nSoundsystem Standart (2 Mic)",
      },
      {
        itemName: "Food and Beverages",
        itemDescription: "1x Buffet\n1x Coffee Break",
      },
    ],
  },
  {
    venueCode: "PTR",
    packageName: "MICE Package - Patrajasa",
    items: [
      {
        itemName: "Ballroom Facilities",
        itemDescription:
          "Patrajasa Yudistira Grand Ballroom usage for 8 hrs\nFull Carpet Ballroom\nFull Air Conditioned\nVoyager Area\nExclusive Chandeliers\n7-meter High Ceiling\n3 Changing Rooms\nExclusive Restroom\nParking area lot up to 600\nCleaning Service\nElectricity 10.000 watt\nSecurity",
      },
      {
        itemName: "Equipments",
        itemDescription:
          "Main Stage\n240 Mix Banquet & Futura Chairs\n4 Registration Table (d120)\nLED Videotron\nSoundsystem Standart (2 MIC)",
      },
      {
        itemName: "Food & Beverage Inclusions",
        itemDescription: "Buffet Meals\nCoffee Break Sessions",
      },
    ],
  },
  {
    venueCode: "LIPPO",
    packageName: "MICE Package - Lippo Kuningan",
    items: [
      {
        itemName: "Ballroom Facilities",
        itemDescription:
          "Ballroom usage for 6 hrs\nFull Carpet Ballroom\nFull Air Conditioned\nVoyager Area\nExclusive Chandeliers\n1 Holding Rooms\n2 Changing Rooms\nParking area up to 600 cars\nElectricity 10.000 watt\nSecurity\nCleaning Service",
      },
      {
        itemName: "Equipments",
        itemDescription:
          "200 Chairs (non-cover)\nRoundtables (d120)\n4 Registration Table\nLED Videotron\nSoundsystem Standart (2 MIC)",
      },
      {
        itemName: "Food & Beverage",
        itemDescription: "(1) Buffet Meals\n(1) Coffee Break for Takjil",
      },
      {
        itemName: "Complimentary",
        itemDescription: "400 Chairs (non cover)",
      },
    ],
  },
  {
    venueCode: "GP2",
    packageName: "MICE Package - Graha Paramita",
    items: [
      {
        itemName: "Ballroom Facilities",
        itemDescription:
          "Graha Paramita II Grand Ballroom usage for 6 hrs\nFull Carpet Ballroom\nFull Air Conditioned\nVoyager Area\nExclusive Chandeliers\n7-meter High Ceiling\nExclusive Restroom\nPrayer Room\nParking area 350 cars\nCleaning Service\nElectricity 10.000 watt\nSecurity",
      },
      {
        itemName: "Equipments",
        itemDescription:
          "100 Tiffany Chairs\n20 Roundtables (d120)\n2 Registration Table (d120)\nLED Videotron\nSoundsystem Standart (2 MIC)",
      },
      {
        itemName: "Food & Beverage Inclusions",
        itemDescription: "(1) Buffet Meals\n(1) Coffee Break",
      },
      {
        itemName: "Complimentary",
        itemDescription: "20 Tiffany Chairs",
      },
    ],
  },
  {
    venueCode: "GST",
    packageName: "MICE Package - Grand Slipi",
    items: [
      {
        itemName: "Ballroom Facilities",
        itemDescription:
          "Grand Slipi Convention Hall usage for 8hrs\nFull Carpet Ballroom\nFull Air Conditioned\nVoyager Area\nExclusive Chandeliers\n7-meter High Ceiling\n1 Multifunction Rooms\n2 Changing Rooms\nParking area up to 600 cars\nElectricity 10.000 watt\nSecurity\nCleaning Service",
      },
      {
        itemName: "Equipments",
        itemDescription:
          "100 Chairs (non cover)\n20 Roundtables (d120)\n2 Registration Table (d120)\nLED Videotron\nSoundsystem Standart (2 MIC)",
      },
      {
        itemName: "Food & Beverage Inclusions : (by Safura)",
        itemDescription: "Buffet Meals 1x\nCoffee Break 1x",
      },
      {
        itemName: "Complimentary",
        itemDescription: "Round Tables + Black Cover\nChairs (non Covers)",
      },
    ],
  },
  {
    venueCode: "TAMRIN",
    packageName: "MICE Package - BRIN Thamrin",
    items: [
      {
        itemName: "Ballroom Facilities",
        itemDescription:
          "BRIN Thamrin Grand Ballroom usage for 8hrs\nFull Carpet Ballroom\nFull Air Conditioned\nVoyager Area\n12-meter High Ceiling\n2 Changing Rooms\nExclusive Restroom\nPrayer Room\nParking area lot up to 800\nCleaning Service\nElectricity 10.000 watt\nSecurity",
      },
      {
        itemName: "Equipments",
        itemDescription:
          "Main Stage\n100 Chairs Futura 300 Kursi Hijau\n600 Chairs on Tribun Area\nRegistration Table",
      },
      {
        itemName: "Complimentary",
        itemDescription: "VIP Room\nSofa VIP di Ruang VIP\nFree Corkage Fee",
      },
    ],
  },
  {
    venueCode: "BRIN",
    packageName: "MICE Package - BRIN Gatot Subroto",
    items: [
      {
        itemName: "Ballroom Facilities",
        itemDescription:
          "BRIN Gatot Subroto Grand Ballroom usage for 6hrs\nFull Carpet Ballroom\nFull Air Conditioned\nVoyager Area\nExclusive Chandeliers\n5-meter High Ceiling\n2 Changing Rooms\nExclusive Restroom\nPrayer Room\nParking area lot up to 500\nCleaning Service\nElectricity 10.000 watt\nSecurity",
      },
      {
        itemName: "Equipments",
        itemDescription:
          "Main Stage\n100 Futura Chairs\n20 Roundtables (d120)\n5 Registration Table (d120)\nLED Videotron 4x3\nSoundsystem Standart (2 MIC)",
      },
      {
        itemName: "Food & Beverage Inclusions",
        itemDescription: "Buffet Meals\nTakjil",
      },
      {
        itemName: "Complimentary",
        itemDescription: "100 Kursi Futura + Cover Hitam\n15 Meja Roundtable",
      },
    ],
  },
  {
    venueCode: "DRM",
    packageName: "MICE Package - Dharmagati",
    items: [
      {
        itemName: "Ballroom Facilities",
        itemDescription:
          "Swasana Dharmagati Grand Ballroom usage for 6hrs\nFull Carpet Ballroom\nFull Air Conditioned\nVoyager Area\nExclusive Chandeliers\n7-meter High Ceiling\n2 Changing Rooms\nExclusive Restroom\nParking area lot up to 500\nCleaning Service\nElectricity 10.000 watt\nSecurity",
      },
      {
        itemName: "Equipments",
        itemDescription:
          "Main Stage\n100 Chairs\n20 Roundtables (d120)\nRegistration Table (d120)\nSoundsystem Standart (2 MIC)",
      },
      {
        itemName: "Food & Beverage Inclusions",
        itemDescription: "Buffet Meals (1x)\nCoffee Break (1x)",
      },
    ],
  },
];

export async function seedMicePackages() {
  // GUARD: additive + idempotent. Skip entirely if any MICE package exists.
  const existingMice = await prisma.package.count({ where: { category: "MICE" } });
  if (existingMice > 0) {
    console.log(
      `⏭️  seedMicePackages skipped — ${existingMice} MICE packages already exist.`,
    );
    return;
  }

  const venues = await prisma.venue.findMany({ select: { id: true, code: true } });
  const venueByCode = new Map(venues.map((v) => [v.code, v.id]));

  // Package creator: prefer sales-mice, fall back to sales, then admin.
  const creator =
    (await findProfileByEmail("sales-mice@swasana.com")) ??
    (await findProfileByEmail("sales@swasana.com")) ??
    (await findProfileByEmail("admin@swasana.com"));

  let count = 0;
  for (const tpl of MICE_TEMPLATES) {
    const venueId = venueByCode.get(tpl.venueCode);
    if (!venueId) {
      console.warn(`⚠️  venue code "${tpl.venueCode}" not found — skipping ${tpl.packageName}`);
      continue;
    }

    // Per-venue idempotency: skip if this venue already has a MICE package.
    const dup = await prisma.package.count({ where: { category: "MICE", venueId } });
    if (dup > 0) {
      console.log(`⏭️  ${tpl.venueCode} already has a MICE package — skipping`);
      continue;
    }

    const created = await prisma.package.create({
      data: {
        packageName: tpl.packageName,
        category: "MICE",
        available: true,
        venueId,
        notes: "",
        pax: 0,
        margin: 50,
        sellingPrice: 0,
        termAndCondition: null, // MICE has no Terms & Conditions
        approvalStatus: "approved",
        createdById: creator?.id ?? null,
        updatedById: creator?.id ?? null,
      },
    });

    for (let i = 0; i < tpl.items.length; i++) {
      const it = tpl.items[i];
      await prisma.packageMiceItem.create({
        data: {
          packageId: created.id,
          itemName: it.itemName,
          itemDescription: it.itemDescription,
          sortOrder: i,
        },
      });
    }

    count++;
  }

  console.log(`✅ ${count} MICE packages seeded (1 template per venue).`);
}

async function findProfileByEmail(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  return prisma.profile.findUnique({ where: { userId: user.id } });
}

// Run standalone
if (process.argv[1].includes("packages-mice")) {
  seedMicePackages()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
