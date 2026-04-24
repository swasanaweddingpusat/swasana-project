import { prisma } from "./_client";

export async function seedBrandsVenues() {
  const brandsData = [
    { name: "Swasana Venue Mastery", code: "SWN" },
    { name: "Gunawarman Hallmark & Event", code: "GNW" },
    { name: "Pakubuwono Event Artistry", code: "PBN" },
  ];

  const brandMap: Record<string, string> = {};
  for (const data of brandsData) {
    const existing = await prisma.brand.findUnique({ where: { code: data.code } });
    const brand = existing ?? await prisma.brand.create({ data });
    brandMap[data.code] = brand.id;
  }
  console.log("✅ 3 Brands seeded");

  const venueInputs = [
    { name: "BRIN Thamrin",       code: "SBT", capacity: 800, address: "Jl. M.H. Thamrin No.8, Jakarta Pusat",               brandCode: "SWN" },
    { name: "BRIN Gatot Subroto", code: "SBG", capacity: 800, address: "Jl. Gatot Subroto No.10, Jakarta Selatan",            brandCode: "SWN" },
    { name: "Seskoad",            code: "SSK", capacity: 800, address: "Jl Gatot Subroto No. 96, Bandung",                    brandCode: "SWN" },
    { name: "Dharmagati",         code: "SDG", capacity: 800, address: "Jl. Raya Jakarta-Bogor, Jakarta Timur",               brandCode: "SWN" },
    { name: "Lippo Kuningan",     code: "SLK", capacity: 800, address: "Jl. HR. Rasuna Said Kav. B12, Jakarta Selatan",       brandCode: "SWN" },
    { name: "Patrajasa",          code: "SPJ", capacity: 800, address: "Jl. Gatot Subroto No.Kav 32-34, Jakarta Selatan",     brandCode: "SWN" },
    { name: "Grand Slipi",        code: "SGS", capacity: 800, address: "Jl. Letjen S. Parman, Jakarta Barat",                 brandCode: "SWN" },
    { name: "Menara Bripens",     code: "GMP", capacity: 800, address: "Jl. Gatot Subroto, Jakarta Selatan",                  brandCode: "GNW" },
    { name: "Samisara Sopodel",   code: "GSS", capacity: 800, address: "Jl.Mega Kuningan Barat III No.1-6, Jakarta Selatan",  brandCode: "PBN" },
    { name: "Paramita",           code: "PKP", capacity: 800, address: "Jl.Boulevard Raya Sektor 7 Bintaro",                  brandCode: "PBN" },
  ];

  const venues = [];
  for (const { brandCode, ...data } of venueInputs) {
    const existing = await prisma.venue.findFirst({ where: { code: data.code } });
    const venue = existing ?? await prisma.venue.create({ data: { ...data, brandId: brandMap[brandCode], isActive: true } });
    venues.push(venue);
  }
  console.log(`✅ ${venues.length} Venues seeded`);

  const sbt = venues.find((v) => v.code === "SBT")!;
  const pmExists = await prisma.paymentMethod.findFirst({ where: { venueId: sbt.id, bankAccountNumber: "1234567890" } });
  if (!pmExists) {
    await prisma.paymentMethod.create({
      data: { venueId: sbt.id, bankName: "BCA", bankAccountNumber: "1234567890", bankRecipient: "PT Swasana Venue Mastery" },
    });
    console.log("✅ 1 Payment Method seeded");
  }

  return venues;
}

// Run standalone
if (process.argv[1].includes("brands-venues")) {
  seedBrandsVenues()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
