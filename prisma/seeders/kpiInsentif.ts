// Seeder: KPI Insentif draft data
// Run: npx tsx prisma/seeders/kpiInsentif.ts
//
// Seeds draft configs for Sales Oktober 2026 targets and achievement schemas.
// All records seeded with isDraft=true — no production payment amounts are activated.
// Business decisions still pending (tier bounds, commission base, deduction basis).

import { prisma } from "./_client";

if (process.argv[1]?.includes("kpiInsentif")) {
  seedKpiInsentif()
    .then(() => {
      console.log("KPI Insentif seed complete.");
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

async function findOrCreate<T extends { id: string }>(
  find: () => Promise<T | null>,
  create: () => Promise<T>
): Promise<T> {
  const existing = await find();
  if (existing) return existing;
  return create();
}

export async function seedKpiInsentif() {
  // ─── Target Items ──────────────────────────────────────────────────────────
  // Oktober 2026 Sales targets from source images.
  // Source dates stored as notes only — their per-row meaning is unconfirmed.

  const dealing = await findOrCreate(
    () => prisma.kpiTargetItem.findFirst({ where: { name: "Jumlah Dealing" } }),
    () =>
      prisma.kpiTargetItem.create({
        data: {
          name: "Jumlah Dealing",
          indicatorType: "dealing",
          type: "qty",
          qty: 9,
          qtyReguler: 2,
          qtyHadjatan: 7,
        },
      })
  );
  console.log("  TargetItem:", dealing.name, "(id:", dealing.id + ")");

  const omset = await findOrCreate(
    () => prisma.kpiTargetItem.findFirst({ where: { name: "Jumlah Omset" } }),
    () =>
      prisma.kpiTargetItem.create({
        data: {
          name: "Jumlah Omset",
          indicatorType: "omset",
          type: "price",
          price: "1340000000",
          priceReguler: "500000000",
          priceHadjatan: "840000000",
        },
      })
  );
  console.log("  TargetItem:", omset.name, "(id:", omset.id + ")");

  const homebase = await findOrCreate(
    () => prisma.kpiTargetItem.findFirst({ where: { name: "Mandatory Home Base Venue" } }),
    () =>
      prisma.kpiTargetItem.create({
        data: {
          name: "Mandatory Home Base Venue",
          indicatorType: "homebase",
          type: "qty",
          qty: 4,
        },
      })
  );
  console.log("  TargetItem:", homebase.name, "(id:", homebase.id + ")");

  // ─── Achievement Schemas ───────────────────────────────────────────────────
  // Tier bounds seeded with isDraftBounds=true — normalization [0,70), [70,80), ...
  // is a proposed interpretation, not confirmed by business owner.
  // Commission base and deduction basis are NOT seeded (missing → blocks finalization).

  const salesSchemaName = "Sales Oktober 2026";
  const existingSales = await prisma.kpiAchievementSchema.findFirst({
    where: { name: salesSchemaName },
    include: { tiers: true },
  });

  let salesSchemaId: string;
  if (existingSales) {
    salesSchemaId = existingSales.id;
    console.log("  AchievementSchema already exists:", salesSchemaName);
  } else {
    const created = await prisma.kpiAchievementSchema.create({
      data: {
        name: salesSchemaName,
        businessRole: "sales",
        isDraft: true,
        gatingMinIndicators: null,
        description:
          "Draft skema bonus Sales Oktober 2026. Batas tier belum dikonfirmasi (isDraftBounds=true). " +
          "Komisi dasar dan dasar potongan belum dikonfigurasi.",
      },
    });
    salesSchemaId = created.id;
    console.log("  AchievementSchema created:", salesSchemaName, "(id:", salesSchemaId + ")");
    await seedSalesTiers(salesSchemaId);
  }

  const managerSchemaName = "Manager (Draft — periode belum ditetapkan)";
  const existingManager = await prisma.kpiAchievementSchema.findFirst({
    where: { name: managerSchemaName },
    include: { tiers: true },
  });

  if (existingManager) {
    console.log("  AchievementSchema already exists:", managerSchemaName);
  } else {
    const created = await prisma.kpiAchievementSchema.create({
      data: {
        name: managerSchemaName,
        businessRole: "manager",
        isDraft: true,
        gatingMinIndicators: 2,
        description:
          "Draft skema bonus Manager. Periode berlaku belum ditetapkan (bukan otomatis Oktober). " +
          "Gating 2 indikator aktif tapi definisi 'tercapai' (≥100% atau >100%) masih pending. " +
          "Konflik <70%: surat peringatan per KPI vs potongan 50% total — belum diputuskan. " +
          "Komisi dasar dan dasar potongan belum dikonfigurasi.",
      },
    });
    console.log("  AchievementSchema created:", managerSchemaName, "(id:", created.id + ")");
    await seedManagerTiers(created.id);
  }

  // ─── KPI Masters ────────────────────────────────────────────────────────────
  const salesMasterName = "KPI Sales September 2026";
  const master = await findOrCreate(
    () => prisma.kpiMaster.findFirst({ where: { name: salesMasterName } }),
    () =>
      prisma.kpiMaster.create({
        data: {
          name: salesMasterName,
          description: "Target KPI Sales untuk bulan September 2026",
          month: new Date("2026-09-01"),
          businessRole: "sales",
          isDraft: false,
          targetItemId: dealing.id,
          achievementSchemaId: salesSchemaId,
        },
      })
  );
  console.log("  KpiMaster:", master.name, "(id:", master.id + ")");

  // ─── KPI Omset & Homebase Masters ─────────────────────────────────────────
  const omsetMaster = await findOrCreate(
    () => prisma.kpiMaster.findFirst({ where: { name: "KPI Omset September 2026" } }),
    () =>
      prisma.kpiMaster.create({
        data: {
          name: "KPI Omset September 2026",
          description: "Target omset Sales untuk bulan September 2026",
          month: new Date("2026-09-01"),
          businessRole: "sales",
          isDraft: false,
          targetItemId: omset.id,
          achievementSchemaId: salesSchemaId,
        },
      })
  );
  console.log("  KpiMaster:", omsetMaster.name, "(id:", omsetMaster.id + ")");

  const homebaseMaster = await findOrCreate(
    () => prisma.kpiMaster.findFirst({ where: { name: "KPI Homebase September 2026" } }),
    () =>
      prisma.kpiMaster.create({
        data: {
          name: "KPI Homebase September 2026",
          description: "Target mandatory homebase venue Sales untuk bulan September 2026",
          month: new Date("2026-09-01"),
          businessRole: "sales",
          isDraft: false,
          targetItemId: homebase.id,
          achievementSchemaId: salesSchemaId,
        },
      })
  );
  console.log("  KpiMaster:", homebaseMaster.name, "(id:", homebaseMaster.id + ")");

  // ─── Commission Policies ──────────────────────────────────────────────────
  const commissionPolicy = await findOrCreate(
    () => prisma.kpiCommissionPolicy.findFirst({ where: { name: "Komisi Sales Reguler Sep 2026" } }),
    () =>
      prisma.kpiCommissionPolicy.create({
        data: {
          name: "Komisi Sales Reguler Sep 2026",
          description: "Komisi per dealing untuk Sales — berlaku September 2026",
          businessRole: "sales",
          isDraft: false,
          nominalPerDeal: "500000",
          pctOfRevenue: null,
          packageCategory: "WEDDINGS",
          effectiveFrom: new Date("2026-09-01"),
          effectiveTo: new Date("2026-09-30"),
        },
      })
  );
  console.log("  CommissionPolicy:", commissionPolicy.name, "(id:", commissionPolicy.id + ")");

  const commissionPolicyMice = await findOrCreate(
    () => prisma.kpiCommissionPolicy.findFirst({ where: { name: "Komisi Sales MICE Sep 2026" } }),
    () =>
      prisma.kpiCommissionPolicy.create({
        data: {
          name: "Komisi Sales MICE Sep 2026",
          description: "Komisi % omset untuk Sales MICE — berlaku September 2026",
          businessRole: "sales",
          isDraft: false,
          nominalPerDeal: null,
          pctOfRevenue: "0.0089",
          packageCategory: "MICE",
          effectiveFrom: new Date("2026-09-01"),
          effectiveTo: new Date("2026-09-30"),
        },
      })
  );
  console.log("  CommissionPolicy:", commissionPolicyMice.name, "(id:", commissionPolicyMice.id + ")");

  // ─── KPI Assignments ──────────────────────────────────────────────────────
  const salesProfiles = await prisma.profile.findMany({
    where: { status: "active", role: { name: { startsWith: "sales" } } },
    take: 4,
    select: { id: true, fullName: true },
  });

  const venues = await prisma.venue.findMany({
    take: 3,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const period = new Date("2026-09-01");

  for (const profile of salesProfiles) {
    for (const m of [master, omsetMaster, homebaseMaster]) {
      await findOrCreate(
        () =>
          prisma.kpiAssignment.findFirst({
            where: { kpiMasterId: m.id, profileId: profile.id, period },
          }),
        () =>
          prisma.kpiAssignment.create({
            data: {
              kpiMasterId: m.id,
              profileId: profile.id,
              period,
              venueId: venues[0]?.id ?? null,
              targetQty: m.targetItemId === dealing.id ? 9 : m.targetItemId === homebase.id ? 4 : null,
              targetPrice: m.targetItemId === omset.id ? "1340000000" : null,
              isDraft: false,
              notes: `Auto-seeded assignment untuk ${profile.fullName}`,
            },
          })
      );
    }
    console.log("  Assignments created for:", profile.fullName);
  }

  // ─── Calculation Results (sample simulated data) ──────────────────────────
  const salesTiers = await prisma.kpiAchievementTier.findMany({
    where: { achievementSchemaId: salesSchemaId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, sortOrder: true, label: true, actionType: true, dealingBonus: true, omsetBonus: true, homebaseBonus: true, deductionPct: true },
  });

  const sampleResults = [
    {
      profileIndex: 0,
      realDealing: 10, realDealingReg: 3, realDealingHadj: 7,
      realOmset: "1450000000", realOmsetReg: "550000000", realOmsetHadj: "900000000",
      realHomebase: 5,
      tierIndex: 4,
      status: "SIMULATED" as const,
    },
    {
      profileIndex: 1,
      realDealing: 7, realDealingReg: 2, realDealingHadj: 5,
      realOmset: "980000000", realOmsetReg: "380000000", realOmsetHadj: "600000000",
      realHomebase: 3,
      tierIndex: 1,
      status: "SIMULATED" as const,
    },
  ];

  for (const sample of sampleResults) {
    const profile = salesProfiles[sample.profileIndex];
    if (!profile) continue;

    const tier = salesTiers[sample.tierIndex];
    if (!tier) continue;

    const dealingPct = (sample.realDealing / 9) * 100;
    const omsetPct = (parseFloat(sample.realOmset) / 1340000000) * 100;
    const homebasePct = (sample.realHomebase / 4) * 100;

    const dealingBonus = tier.actionType === "bonus" && tier.dealingBonus ? parseFloat(String(tier.dealingBonus)) : 0;
    const omsetBonusVal = tier.actionType === "bonus" && tier.omsetBonus ? parseFloat(String(tier.omsetBonus)) : 0;
    const homebaseBonusVal = tier.actionType === "bonus" && tier.homebaseBonus ? parseFloat(String(tier.homebaseBonus)) : 0;
    const totalBonus = dealingBonus + omsetBonusVal + homebaseBonusVal;

    const baseCommReg = sample.realDealingReg * 500000;
    const baseCommHadj = sample.realDealingHadj * 500000;
    const baseCommTotal = baseCommReg + baseCommHadj;

    const deductionPctVal = tier.actionType === "deduction" && tier.deductionPct ? parseFloat(String(tier.deductionPct)) : 0;
    const deductionAmount = deductionPctVal > 0 ? (baseCommTotal * deductionPctVal) / 100 : 0;

    const grossAmount = baseCommTotal + totalBonus;
    const netAmount = grossAmount - deductionAmount;

    const result = await findOrCreate(
      () =>
        prisma.kpiCalculationResult.findFirst({
          where: { profileId: profile.id, period, venueId: venues[0]?.id ?? null },
        }),
      () =>
        prisma.kpiCalculationResult.create({
          data: {
            profileId: profile.id,
            venueId: venues[0]?.id ?? null,
            period,
            realDealingTotal: sample.realDealing,
            realDealingReguler: sample.realDealingReg,
            realDealingHadjatan: sample.realDealingHadj,
            realOmsetTotal: sample.realOmset,
            realOmsetReguler: sample.realOmsetReg,
            realOmsetHadjatan: sample.realOmsetHadj,
            realHomebase: sample.realHomebase,
            targetDealingTotal: 9,
            targetOmsetTotal: "1340000000",
            targetHomebase: 4,
            dealingAchievementPct: String(dealingPct.toFixed(4)),
            omsetAchievementPct: String(omsetPct.toFixed(4)),
            homebaseAchievementPct: String(homebasePct.toFixed(4)),
            dealingTierId: tier.id,
            omsetTierId: tier.id,
            homebaseTierId: tier.id,
            dealingBonus: String(dealingBonus),
            omsetBonus: String(omsetBonusVal),
            homebaseBonus: String(homebaseBonusVal),
            totalBonus: String(totalBonus),
            baseCommissionReguler: String(baseCommReg),
            baseCommissionHadjatan: String(baseCommHadj),
            baseCommissionTotal: String(baseCommTotal),
            deductionTriggerIndicator: deductionPctVal > 0 ? "dealing" : null,
            deductionPct: deductionPctVal > 0 ? String(deductionPctVal) : null,
            deductionAmount: String(deductionAmount),
            grossAmount: String(grossAmount),
            netAmount: String(netAmount),
            status: sample.status,
            grade: dealingPct >= 100 ? "A" : dealingPct >= 90 ? "B" : dealingPct >= 80 ? "C" : "D",
            calculatedAt: new Date(),
            notes: `Hasil simulasi untuk ${profile.fullName} — September 2026`,
          },
        })
    );

    const existingDetails = await prisma.kpiCalculationDetail.findFirst({
      where: { resultId: result.id },
    });
    if (!existingDetails) {
      await prisma.kpiCalculationDetail.createMany({
        data: [
          {
            resultId: result.id,
            indicatorType: "dealing",
            targetValue: "9",
            realValue: String(sample.realDealing),
            achievementPct: String(dealingPct.toFixed(4)),
            tierId: tier.id,
            tierLabel: tier.label,
            actionType: tier.actionType,
            bonusAmount: String(dealingBonus),
            deductionPct: deductionPctVal > 0 ? String(deductionPctVal) : null,
            isGatingFailed: false,
          },
          {
            resultId: result.id,
            indicatorType: "omset",
            targetValue: "1340000000",
            realValue: sample.realOmset,
            achievementPct: String(omsetPct.toFixed(4)),
            tierId: tier.id,
            tierLabel: tier.label,
            actionType: tier.actionType,
            bonusAmount: String(omsetBonusVal),
            deductionPct: deductionPctVal > 0 ? String(deductionPctVal) : null,
            isGatingFailed: false,
          },
          {
            resultId: result.id,
            indicatorType: "homebase",
            targetValue: "4",
            realValue: String(sample.realHomebase),
            achievementPct: String(homebasePct.toFixed(4)),
            tierId: tier.id,
            tierLabel: tier.label,
            actionType: tier.actionType,
            bonusAmount: String(homebaseBonusVal),
            deductionPct: null,
            isGatingFailed: false,
          },
        ],
      });
    }

    console.log("  CalcResult created for:", profile.fullName, "— Grade:", dealingPct >= 100 ? "A" : dealingPct >= 90 ? "B" : "C/D", "— Net:", netAmount.toLocaleString("id-ID"));
  }
}

async function seedSalesTiers(schemaId: string) {
  const salesTiers = [
    {
      lowerBound: "0",
      upperBound: "70",
      lowerInclusive: true,
      upperInclusive: false,
      isDraftBounds: true,
      actionType: "deduction" as const,
      dealingBonus: null,
      omsetBonus: null,
      homebaseBonus: null,
      deductionPct: "50",
      isWarningFlag: false,
      label: "<70% — Potongan komisi 50%",
    },
    {
      lowerBound: "70",
      upperBound: "80",
      lowerInclusive: true,
      upperInclusive: false,
      isDraftBounds: true,
      actionType: "deduction" as const,
      dealingBonus: null,
      omsetBonus: null,
      homebaseBonus: null,
      deductionPct: "40",
      isWarningFlag: false,
      label: ">70%–79% — Potongan komisi 40%",
    },
    {
      lowerBound: "80",
      upperBound: "90",
      lowerInclusive: true,
      upperInclusive: false,
      isDraftBounds: true,
      actionType: "deduction" as const,
      dealingBonus: null,
      omsetBonus: null,
      homebaseBonus: null,
      deductionPct: "30",
      isWarningFlag: false,
      label: ">80%–89% — Potongan komisi 30%",
    },
    {
      lowerBound: "90",
      upperBound: "100",
      lowerInclusive: true,
      upperInclusive: false,
      isDraftBounds: true,
      actionType: "deduction" as const,
      dealingBonus: null,
      omsetBonus: null,
      homebaseBonus: null,
      deductionPct: "20",
      isWarningFlag: false,
      label: ">90%–99% — Potongan komisi 20%",
    },
    {
      lowerBound: "100",
      upperBound: "105",
      lowerInclusive: true,
      upperInclusive: true,
      isDraftBounds: true,
      actionType: "bonus" as const,
      dealingBonus: "2500000",
      omsetBonus: "2500000",
      homebaseBonus: "1000000",
      deductionPct: null,
      isWarningFlag: false,
      label: ">100%–105%",
    },
    {
      lowerBound: "105",
      upperBound: "110",
      lowerInclusive: false,
      upperInclusive: true,
      isDraftBounds: true,
      actionType: "bonus" as const,
      dealingBonus: "3000000",
      omsetBonus: "3000000",
      homebaseBonus: "1250000",
      deductionPct: null,
      isWarningFlag: false,
      label: ">105%–110%",
    },
    {
      lowerBound: "110",
      upperBound: "115",
      lowerInclusive: false,
      upperInclusive: true,
      isDraftBounds: true,
      actionType: "bonus" as const,
      dealingBonus: "3500000",
      omsetBonus: "3500000",
      homebaseBonus: "1500000",
      deductionPct: null,
      isWarningFlag: false,
      label: ">110%–115%",
    },
    {
      lowerBound: "115",
      upperBound: "120",
      lowerInclusive: false,
      upperInclusive: true,
      isDraftBounds: true,
      actionType: "bonus" as const,
      dealingBonus: "4000000",
      omsetBonus: "4000000",
      homebaseBonus: "1750000",
      deductionPct: null,
      isWarningFlag: false,
      label: ">115%–120%",
    },
    {
      lowerBound: "120",
      upperBound: null,
      lowerInclusive: false,
      upperInclusive: false,
      isDraftBounds: true,
      actionType: "bonus" as const,
      dealingBonus: "5000000",
      omsetBonus: "5000000",
      homebaseBonus: "2000000",
      deductionPct: null,
      isWarningFlag: false,
      label: ">120%",
    },
  ];

  for (const [i, tier] of salesTiers.entries()) {
    await prisma.kpiAchievementTier.create({
      data: { achievementSchemaId: schemaId, sortOrder: i, ...tier },
    });
  }
  console.log(`  Sales tiers seeded: ${salesTiers.length} rows`);
}

async function seedManagerTiers(schemaId: string) {
  const managerTiers = [
    // <70%: konflik surat peringatan + potongan 50% — belum diputuskan mana yang berlaku.
    // Simpan sebagai WARNING + deductionPct=50 agar kedua opsi tersimpan.
    {
      lowerBound: "0",
      upperBound: "70",
      lowerInclusive: true,
      upperInclusive: false,
      isDraftBounds: true,
      actionType: "warning" as const,
      dealingBonus: null,
      omsetBonus: null,
      homebaseBonus: null,
      deductionPct: "50",
      isWarningFlag: true,
      label: "<70% — Surat peringatan + Potongan 50% (konflik belum diputuskan)",
    },
    {
      lowerBound: "70",
      upperBound: "80",
      lowerInclusive: true,
      upperInclusive: false,
      isDraftBounds: true,
      actionType: "deduction" as const,
      dealingBonus: null,
      omsetBonus: null,
      homebaseBonus: null,
      deductionPct: "40",
      isWarningFlag: false,
      label: ">70%–79% — Potongan komisi 40%",
    },
    {
      lowerBound: "80",
      upperBound: "90",
      lowerInclusive: true,
      upperInclusive: false,
      isDraftBounds: true,
      actionType: "deduction" as const,
      dealingBonus: null,
      omsetBonus: null,
      homebaseBonus: null,
      deductionPct: "30",
      isWarningFlag: false,
      label: ">80%–89% — Potongan komisi 30%",
    },
    {
      lowerBound: "90",
      upperBound: "100",
      lowerInclusive: true,
      upperInclusive: false,
      isDraftBounds: true,
      actionType: "deduction" as const,
      dealingBonus: null,
      omsetBonus: null,
      homebaseBonus: null,
      deductionPct: "20",
      isWarningFlag: false,
      label: ">90%–99% — Potongan komisi 20%",
    },
    {
      lowerBound: "100",
      upperBound: "105",
      lowerInclusive: true,
      upperInclusive: true,
      isDraftBounds: true,
      actionType: "bonus" as const,
      dealingBonus: "5000000",
      omsetBonus: "3000000",
      homebaseBonus: "1000000",
      deductionPct: null,
      isWarningFlag: false,
      label: ">100%–105%",
    },
    {
      lowerBound: "105",
      upperBound: "110",
      lowerInclusive: false,
      upperInclusive: true,
      isDraftBounds: true,
      actionType: "bonus" as const,
      dealingBonus: "6000000",
      omsetBonus: "4000000",
      homebaseBonus: "1500000",
      deductionPct: null,
      isWarningFlag: false,
      label: ">105%–110%",
    },
    {
      lowerBound: "110",
      upperBound: "115",
      lowerInclusive: false,
      upperInclusive: true,
      isDraftBounds: true,
      actionType: "bonus" as const,
      dealingBonus: "7000000",
      omsetBonus: "5000000",
      homebaseBonus: "2000000",
      deductionPct: null,
      isWarningFlag: false,
      label: ">110%–115%",
    },
    {
      lowerBound: "115",
      upperBound: "120",
      lowerInclusive: false,
      upperInclusive: true,
      isDraftBounds: true,
      actionType: "bonus" as const,
      dealingBonus: "8000000",
      omsetBonus: "6000000",
      homebaseBonus: "2500000",
      deductionPct: null,
      isWarningFlag: false,
      label: ">115%–120%",
    },
    {
      lowerBound: "120",
      upperBound: null,
      lowerInclusive: false,
      upperInclusive: false,
      isDraftBounds: true,
      actionType: "bonus" as const,
      dealingBonus: "10000000",
      omsetBonus: "8000000",
      homebaseBonus: "3000000",
      deductionPct: null,
      isWarningFlag: false,
      label: ">120%",
    },
  ];

  for (const [i, tier] of managerTiers.entries()) {
    await prisma.kpiAchievementTier.create({
      data: { achievementSchemaId: schemaId, sortOrder: i, ...tier },
    });
  }
  console.log(`  Manager tiers seeded: ${managerTiers.length} rows`);
}
