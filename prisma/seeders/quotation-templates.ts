import { prisma } from "./_client";

// Section header items: qty=0, price=0, total=0 — used as visual group separators
// in the quotation form (no native "category" field on QuotationTemplateItem).

export async function seedQuotationTemplates() {
  // ── 1. Resolve Samisara venue ──────────────────────────────────────────────
  const samisaraVenue = await prisma.venue.findFirst({
    where: { code: "SAMISARA" },
    select: { id: true, name: true },
  });

  if (!samisaraVenue) {
    console.error("❌ Venue SAMISARA not found — run seedBrandsVenues() first");
    return;
  }

  // ── 2. Upsert default payment method for Samisara venue ───────────────────
  const existingPm = await prisma.paymentMethod.findFirst({
    where: {
      venueId: samisaraVenue.id,
      bankAccountNumber: "7150001234",
    },
  });

  const paymentMethod =
    existingPm ??
    (await prisma.paymentMethod.create({
      data: {
        venueId: samisaraVenue.id,
        bankName: "BCA",
        bankAccountNumber: "7150001234",
        bankRecipient: "PT Gunawarman Hallmark & Event",
      },
    }));

  // ── 3. Upsert QuotationTemplate for Samisara ──────────────────────────────
  const existing = await prisma.quotationTemplate.findUnique({
    where: { venueId: samisaraVenue.id },
  });

  const template =
    existing ??
    (await prisma.quotationTemplate.create({
      data: {
        venueId: samisaraVenue.id,
        paymentMethodId: paymentMethod.id,
      },
    }));

  // If template already existed, ensure paymentMethodId is up-to-date
  if (existing && existing.paymentMethodId !== paymentMethod.id) {
    await prisma.quotationTemplate.update({
      where: { id: template.id },
      data: { paymentMethodId: paymentMethod.id },
    });
  }

  // ── 4. Seed items (idempotent: delete-then-insert so order stays clean) ───
  // Only re-seed if template has no items yet, to avoid duplicating on re-run.
  const existingItemCount = await prisma.quotationTemplateItem.count({
    where: { templateId: template.id },
  });

  if (existingItemCount > 0) {
    console.log(
      `⏩ QuotationTemplate items for Samisara already exist (${existingItemCount} items) — skipping`
    );
    console.log(`✅ QuotationTemplate for "${samisaraVenue.name}" is ready`);
    return;
  }

  // Items are ordered: section header first, then its items.
  // Section headers use qty=0, price=0 so they render as decorative rows.
  const items: {
    title: string;
    description?: string;
    qty: number;
    price: number;
    total: number;
    manualTotal: boolean;
    sortOrder: number;
  }[] = [
    // ── Section A: Ballroom Facilities ──────────────────────────────────────
    {
      title: "Ballroom Facilities",
      qty: 0,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 1,
    },
    {
      title: "Samisara Grand Ballroom for 6 hours",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 2,
    },
    {
      title: "Full Carpet Ballroom",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 3,
    },
    {
      title: "Full Air Conditioned",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 4,
    },
    {
      title: "Voyager Area",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 5,
    },
    {
      title: "2 Holding Room",
      qty: 2,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 6,
    },
    {
      title: "5-meter High Ceiling",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 7,
    },
    {
      title: "2 Changing Rooms",
      qty: 2,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 8,
    },
    {
      title: "Exclusive Restroom",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 9,
    },
    {
      title: "Parking area lot up to 800",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 10,
    },
    {
      title: "Cleaning Service",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 11,
    },
    {
      title: "Electricity 10.000 watt",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 12,
    },
    {
      title: "Security",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 13,
    },

    // ── Section B: Equipments ───────────────────────────────────────────────
    {
      title: "Equipments",
      qty: 0,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 14,
    },
    {
      title: "Main Stage",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 15,
    },
    {
      title: "100 Banquet Chairs",
      qty: 100,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 16,
    },
    {
      title: "4 Registration Table (d120)",
      qty: 4,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 17,
    },
    {
      title: "LED Videotron 4x3",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 18,
    },
    {
      title: "Soundsystem Standart (2 MIC)",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 19,
    },
  ];

  await prisma.quotationTemplateItem.createMany({
    data: items.map((item) => ({ ...item, templateId: template.id })),
  });

  console.log(
    `✅ QuotationTemplate for "${samisaraVenue.name}" seeded — 2 section headers + 17 items`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bripens (Menara Bripens) — brand: Gunawarman Hallmark & Event (GNW)
// ─────────────────────────────────────────────────────────────────────────────

export async function seedBripensQuotationTemplate() {
  // ── 1. Resolve Bripens venue ───────────────────────────────────────────────
  const bripensVenue = await prisma.venue.findFirst({
    where: { code: "BRIPENS" },
    select: { id: true, name: true },
  });

  if (!bripensVenue) {
    console.error("❌ Venue BRIPENS not found — run seedBrandsVenues() first");
    return;
  }

  // ── 2. Upsert default payment method for Bripens venue ────────────────────
  // Bripens & Samisara share the same brand (Gunawarman Hallmark & Event).
  // Payment method is venue-scoped; using the same bank/recipient as Samisara.
  // ⚠️  Replace bankAccountNumber with the actual Bripens/GNW account number.
  const existingPm = await prisma.paymentMethod.findFirst({
    where: {
      venueId: bripensVenue.id,
      bankAccountNumber: "7150001234",
    },
  });

  const paymentMethod =
    existingPm ??
    (await prisma.paymentMethod.create({
      data: {
        venueId: bripensVenue.id,
        bankName: "BCA",
        bankAccountNumber: "7150001234", // ⚠️ PLACEHOLDER — update with real Bripens account
        bankRecipient: "PT Gunawarman Hallmark & Event",
      },
    }));

  // ── 3. Upsert QuotationTemplate for Bripens ───────────────────────────────
  const existing = await prisma.quotationTemplate.findUnique({
    where: { venueId: bripensVenue.id },
  });

  const template =
    existing ??
    (await prisma.quotationTemplate.create({
      data: {
        venueId: bripensVenue.id,
        paymentMethodId: paymentMethod.id,
      },
    }));

  // If template already existed, ensure paymentMethodId is up-to-date
  if (existing && existing.paymentMethodId !== paymentMethod.id) {
    await prisma.quotationTemplate.update({
      where: { id: template.id },
      data: { paymentMethodId: paymentMethod.id },
    });
  }

  // ── 4. Seed items (idempotent: only insert if template has no items yet) ───
  const existingItemCount = await prisma.quotationTemplateItem.count({
    where: { templateId: template.id },
  });

  if (existingItemCount > 0) {
    console.log(
      `⏩ QuotationTemplate items for Bripens already exist (${existingItemCount} items) — skipping`
    );
    console.log(`✅ QuotationTemplate for "${bripensVenue.name}" is ready`);
    return;
  }

  // Items are ordered: section header first, then its items.
  // Section headers use qty=0, price=0 so they render as decorative rows.
  const items: {
    title: string;
    description?: string;
    qty: number;
    price: number;
    total: number;
    manualTotal: boolean;
    sortOrder: number;
  }[] = [
    // ── Section A: Ballroom Facilities ──────────────────────────────────────
    {
      title: "Ballroom Facilities",
      qty: 0,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 1,
    },
    {
      title: "Menara Bripens Grand Ballroom for 6 hours",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 2,
    },
    {
      title: "Full Carpet Ballroom",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 3,
    },
    {
      title: "Full Air Conditioned",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 4,
    },
    {
      title: "Exclusive Chandeliers",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 5,
    },
    {
      title: "8-meter High Ceiling",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 6,
    },
    {
      title: "2 Changing Rooms",
      qty: 2,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 7,
    },
    {
      title: "1 Holding Room",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 8,
    },
    {
      title: "Exclusive Restroom",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 9,
    },
    {
      title: "Prayer Room",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 10,
    },
    {
      title: "Parking area lot up to 800",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 11,
    },
    {
      title: "Cleaning Service",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 12,
    },
    {
      title: "Electricity 10.000 watt",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 13,
    },
    {
      title: "Security",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 14,
    },

    // ── Section B: Equipments ───────────────────────────────────────────────
    {
      title: "Equipments",
      qty: 0,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 15,
    },
    {
      title: "Main Stage",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 16,
    },
    {
      title: "100 Tiffany Chairs",
      qty: 100,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 17,
    },
    {
      title: "20 Roundtables (d120)",
      qty: 20,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 18,
    },
    {
      title: "10 Registration Table (d120)",
      qty: 10,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 19,
    },
    {
      title: "LED Videotron",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 20,
    },
    {
      title: "Soundsystem Standart (2 MIC)",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 21,
    },

    // ── Section C: Food & Beverage Inclusions ───────────────────────────────
    {
      title: "Food & Beverage Inclusions",
      qty: 0,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 22,
    },
    {
      title: "Buffet Meals",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 23,
    },
    {
      title: "Coffee Break Sessions",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 24,
    },
  ];

  await prisma.quotationTemplateItem.createMany({
    data: items.map((item) => ({ ...item, templateId: template.id })),
  });

  console.log(
    `✅ QuotationTemplate for "${bripensVenue.name}" seeded — 3 section headers + 21 items`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Patrajasa — brand: Swasana Venue Mastery (SWN)
// ─────────────────────────────────────────────────────────────────────────────

export async function seedPatrajasaQuotationTemplate() {
  // ── 1. Resolve Patrajasa venue ────────────────────────────────────────────
  const patrajasaVenue = await prisma.venue.findFirst({
    where: { code: "PTR" },
    select: { id: true, name: true },
  });

  if (!patrajasaVenue) {
    console.error("❌ Venue PTR (Patrajasa) not found — run seedBrandsVenues() first");
    return;
  }

  // ── 2. Upsert default payment method for Patrajasa venue ─────────────────
  // Patrajasa is under brand Swasana Venue Mastery (SWN).
  // ⚠️  Replace bankAccountNumber with the actual Patrajasa/SWN account number.
  const existingPm = await prisma.paymentMethod.findFirst({
    where: {
      venueId: patrajasaVenue.id,
      bankAccountNumber: "1234567890",
    },
  });

  const paymentMethod =
    existingPm ??
    (await prisma.paymentMethod.create({
      data: {
        venueId: patrajasaVenue.id,
        bankName: "BCA",
        bankAccountNumber: "1234567890", // ⚠️ PLACEHOLDER — update with real Patrajasa account
        bankRecipient: "PT Swasana Venue Mastery",
      },
    }));

  // ── 3. Upsert QuotationTemplate for Patrajasa ─────────────────────────────
  const existing = await prisma.quotationTemplate.findUnique({
    where: { venueId: patrajasaVenue.id },
  });

  const template =
    existing ??
    (await prisma.quotationTemplate.create({
      data: {
        venueId: patrajasaVenue.id,
        paymentMethodId: paymentMethod.id,
      },
    }));

  // If template already existed, ensure paymentMethodId is up-to-date
  if (existing && existing.paymentMethodId !== paymentMethod.id) {
    await prisma.quotationTemplate.update({
      where: { id: template.id },
      data: { paymentMethodId: paymentMethod.id },
    });
  }

  // ── 4. Seed items (idempotent: only insert if template has no items yet) ───
  const existingItemCount = await prisma.quotationTemplateItem.count({
    where: { templateId: template.id },
  });

  if (existingItemCount > 0) {
    console.log(
      `⏩ QuotationTemplate items for Patrajasa already exist (${existingItemCount} items) — skipping`
    );
    console.log(`✅ QuotationTemplate for "${patrajasaVenue.name}" is ready`);
    return;
  }

  const items: {
    title: string;
    description?: string;
    qty: number;
    price: number;
    total: number;
    manualTotal: boolean;
    sortOrder: number;
  }[] = [
    // ── Section A: Ballroom Facilities ──────────────────────────────────────
    {
      title: "Ballroom Facilities",
      qty: 0,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 1,
    },
    {
      title: "Patrajasa Yudistira Grand Ballroom usage for 6hrs",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 2,
    },
    {
      title: "Full Carpet Ballroom",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 3,
    },
    {
      title: "Full Air Conditioned",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 4,
    },
    {
      title: "Voyager Area",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 5,
    },
    {
      title: "Exclusive Chandeliers",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 6,
    },
    {
      title: "7-meter High Ceiling",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 7,
    },
    {
      title: "3 Changing Rooms",
      qty: 3,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 8,
    },
    {
      title: "Exclusive Restroom",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 9,
    },
    {
      title: "Parking area lot up to 600",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 10,
    },
    {
      title: "Cleaning Service",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 11,
    },
    {
      title: "Electricity 10.000 watt",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 12,
    },
    {
      title: "Security",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 13,
    },

    // ── Section B: Equipments ───────────────────────────────────────────────
    {
      title: "Equipments",
      qty: 0,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 14,
    },
    {
      title: "Main Stage",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 15,
    },
    {
      title: "200 Mix Banquet & Futura Chairs",
      qty: 200,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 16,
    },
    {
      title: "4 Registration Table (d120)",
      qty: 4,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 17,
    },
    {
      title: "LED Videotron",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 18,
    },
    {
      title: "Soundsystem Standart (2 MIC)",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 19,
    },
  ];

  await prisma.quotationTemplateItem.createMany({
    data: items.map((item) => ({ ...item, templateId: template.id })),
  });

  console.log(
    `✅ QuotationTemplate for "${patrajasaVenue.name}" seeded — 2 section headers + 17 items`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Lippo Kuningan — brand: Swasana Venue Mastery (SWN)
// ─────────────────────────────────────────────────────────────────────────────

export async function seedLippoQuotationTemplate() {
  // ── 1. Resolve Lippo Kuningan venue ──────────────────────────────────────
  const lippoVenue = await prisma.venue.findFirst({
    where: { code: "LIPPO" },
    select: { id: true, name: true },
  });

  if (!lippoVenue) {
    console.error("❌ Venue LIPPO (Lippo Kuningan) not found — run seedBrandsVenues() first");
    return;
  }

  // ── 2. Upsert default payment method for Lippo venue ─────────────────────
  // Lippo Kuningan is under brand Swasana Venue Mastery (SWN).
  // ⚠️  Replace bankAccountNumber with the actual Lippo/SWN account number.
  const existingPm = await prisma.paymentMethod.findFirst({
    where: {
      venueId: lippoVenue.id,
      bankAccountNumber: "1234567890",
    },
  });

  const paymentMethod =
    existingPm ??
    (await prisma.paymentMethod.create({
      data: {
        venueId: lippoVenue.id,
        bankName: "BCA",
        bankAccountNumber: "1234567890", // ⚠️ PLACEHOLDER — update with real Lippo account
        bankRecipient: "PT Swasana Venue Mastery",
      },
    }));

  // ── 3. Upsert QuotationTemplate for Lippo ────────────────────────────────
  const existing = await prisma.quotationTemplate.findUnique({
    where: { venueId: lippoVenue.id },
  });

  const template =
    existing ??
    (await prisma.quotationTemplate.create({
      data: {
        venueId: lippoVenue.id,
        paymentMethodId: paymentMethod.id,
      },
    }));

  // If template already existed, ensure paymentMethodId is up-to-date
  if (existing && existing.paymentMethodId !== paymentMethod.id) {
    await prisma.quotationTemplate.update({
      where: { id: template.id },
      data: { paymentMethodId: paymentMethod.id },
    });
  }

  // ── 4. Seed items (idempotent: only insert if template has no items yet) ───
  const existingItemCount = await prisma.quotationTemplateItem.count({
    where: { templateId: template.id },
  });

  if (existingItemCount > 0) {
    console.log(
      `⏩ QuotationTemplate items for Lippo Kuningan already exist (${existingItemCount} items) — skipping`
    );
    console.log(`✅ QuotationTemplate for "${lippoVenue.name}" is ready`);
    return;
  }

  const items: {
    title: string;
    description?: string;
    qty: number;
    price: number;
    total: number;
    manualTotal: boolean;
    sortOrder: number;
  }[] = [
    // ── Section A: Ballroom Facilities ──────────────────────────────────────
    {
      title: "Ballroom Facilities",
      qty: 0,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 1,
    },
    {
      title: "Ballroom usage for 12hrs",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 2,
    },
    {
      title: "Full Carpet Ballroom",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 3,
    },
    {
      title: "Full Air Conditioned",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 4,
    },
    {
      title: "Voyager Area",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 5,
    },
    {
      title: "Exclusive Chandeliers",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 6,
    },
    {
      title: "1 Holding Rooms",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 7,
    },
    {
      title: "2 Changing Rooms",
      qty: 2,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 8,
    },
    {
      title: "Parking area up to 600 cars",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 9,
    },
    {
      title: "Electricity 10.000 watt",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 10,
    },
    {
      title: "Security",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 11,
    },
    {
      title: "Cleaning Service",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 12,
    },

    // ── Section B: Equipments ───────────────────────────────────────────────
    {
      title: "Equipments",
      qty: 0,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 13,
    },
    {
      title: "100 Futura Chairs",
      qty: 100,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 14,
    },
    {
      title: "20 Roundtables (d120)",
      qty: 20,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 15,
    },
    {
      title: "4 Registration Table",
      qty: 4,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 16,
    },
    {
      title: "LED Videotron",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 17,
    },
    {
      title: "Soundsystem Standart (2 MIC)",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 18,
    },

    // ── Section C: Food & Beverage Inclusions ───────────────────────────────
    {
      title: "Food & Beverage Inclusions",
      qty: 0,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 19,
    },
    {
      title: "1 Time Buffet Meals",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 20,
    },
    {
      title: "2 Times Coffee Break",
      qty: 2,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 21,
    },
  ];

  await prisma.quotationTemplateItem.createMany({
    data: items.map((item) => ({ ...item, templateId: template.id })),
  });

  console.log(
    `✅ QuotationTemplate for "${lippoVenue.name}" seeded — 3 section headers + 18 items`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Paramita (Graha Paramita II) — brand: Pakubuwono Event Artistry (PBN)
// ─────────────────────────────────────────────────────────────────────────────

export async function seedParamitaQuotationTemplate() {
  // ── 1. Resolve Paramita venue ─────────────────────────────────────────────
  const paramitaVenue = await prisma.venue.findFirst({
    where: { code: "GP2" },
    select: { id: true, name: true },
  });

  if (!paramitaVenue) {
    console.error("❌ Venue GP2 (Paramita) not found — run seedBrandsVenues() first");
    return;
  }

  // ── 2. Upsert default payment method for Paramita venue ───────────────────
  // Paramita is under brand Pakubuwono Event Artistry (PBN).
  // ⚠️  Replace bankAccountNumber with the actual Paramita/PBN account number.
  const existingPm = await prisma.paymentMethod.findFirst({
    where: {
      venueId: paramitaVenue.id,
      bankAccountNumber: "1234567890",
    },
  });

  const paymentMethod =
    existingPm ??
    (await prisma.paymentMethod.create({
      data: {
        venueId: paramitaVenue.id,
        bankName: "BCA",
        bankAccountNumber: "1234567890", // ⚠️ PLACEHOLDER — update with real Paramita/PBN account
        bankRecipient: "PT Pakubuwono Event Artistry",
      },
    }));

  // ── 3. Upsert QuotationTemplate for Paramita ──────────────────────────────
  const existing = await prisma.quotationTemplate.findUnique({
    where: { venueId: paramitaVenue.id },
  });

  const template =
    existing ??
    (await prisma.quotationTemplate.create({
      data: {
        venueId: paramitaVenue.id,
        paymentMethodId: paymentMethod.id,
      },
    }));

  // If template already existed, ensure paymentMethodId is up-to-date
  if (existing && existing.paymentMethodId !== paymentMethod.id) {
    await prisma.quotationTemplate.update({
      where: { id: template.id },
      data: { paymentMethodId: paymentMethod.id },
    });
  }

  // ── 4. Seed items (idempotent: only insert if template has no items yet) ───
  const existingItemCount = await prisma.quotationTemplateItem.count({
    where: { templateId: template.id },
  });

  if (existingItemCount > 0) {
    console.log(
      `⏩ QuotationTemplate items for Paramita already exist (${existingItemCount} items) — skipping`
    );
    console.log(`✅ QuotationTemplate for "${paramitaVenue.name}" is ready`);
    return;
  }

  const items: {
    title: string;
    description?: string;
    qty: number;
    price: number;
    total: number;
    manualTotal: boolean;
    sortOrder: number;
  }[] = [
    // ── Section A: Ballroom Facilities ──────────────────────────────────────
    {
      title: "Ballroom Facilities",
      qty: 0,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 1,
    },
    {
      title: "Graha Paramita II Grand Ballroom usage for 12hrs",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 2,
    },
    {
      title: "Full Carpet Ballroom",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 3,
    },
    {
      title: "Full Air Conditioned",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 4,
    },
    {
      title: "Voyager Area",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 5,
    },
    {
      title: "Exclusive Chandeliers",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 6,
    },
    {
      title: "7-meter High Ceiling",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 7,
    },
    {
      title: "2 Changing Rooms",
      qty: 2,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 8,
    },
    {
      title: "Children's Playground Area",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 9,
    },
    {
      title: "Exclusive Restroom",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 10,
    },
    {
      title: "Prayer Room",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 11,
    },
    {
      title: "Parking area 350 cars",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 12,
    },
    {
      title: "Cleaning Service",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 13,
    },
    {
      title: "Electricity 10.000 watt",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 14,
    },
    {
      title: "Security",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 15,
    },

    // ── Section B: Equipments ───────────────────────────────────────────────
    {
      title: "Equipments",
      qty: 0,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 16,
    },
    {
      title: "100 Tiffany Chairs",
      qty: 100,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 17,
    },
    {
      title: "20 Roundtables (d120)",
      qty: 20,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 18,
    },
    {
      title: "10 Registration Table (d120)",
      qty: 10,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 19,
    },
    {
      title: "LED Videotron",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 20,
    },
    {
      title: "Soundsystem Standart (2 MIC)",
      qty: 1,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 21,
    },

    // ── Section C: Food & Beverage Inclusions ───────────────────────────────
    {
      title: "Food & Beverage Inclusions",
      qty: 0,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 22,
    },
    {
      title: "Two (2) Buffet Meals",
      qty: 2,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 23,
    },
    {
      title: "Two (2) Coffee Break Sessions",
      qty: 2,
      price: 0,
      total: 0,
      manualTotal: false,
      sortOrder: 24,
    },
  ];

  await prisma.quotationTemplateItem.createMany({
    data: items.map((item) => ({ ...item, templateId: template.id })),
  });

  console.log(
    `✅ QuotationTemplate for "${paramitaVenue.name}" seeded — 3 section headers + 21 items`
  );
}

// Run standalone
if (process.argv[1].includes("quotation-templates")) {
  Promise.all([
    seedQuotationTemplates(),
    seedBripensQuotationTemplate(),
    seedPatrajasaQuotationTemplate(),
    seedLippoQuotationTemplate(),
    seedParamitaQuotationTemplate(),
  ])
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
