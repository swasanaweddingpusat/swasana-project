// FILE: actions/kpiInsentif.ts
"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { Decimal } from "@prisma/client/runtime/client";
import {
  computeKpiResult,
  computeOverAchievementBonus,
  computeStagedPayment,
  type KpiRealization,
  type KpiTarget,
  type AchievementSchemaInput,
  type KpiTierAction,
  type KpiBusinessRole,
  type CommissionPolicyInput,
  type StagedPaymentDealInput,
} from "@/lib/services/kpiCalculation";
import { logAudit } from "@/lib/audit";
import {
  createTargetItemSchema,
  updateTargetItemSchema,
  createAchievementSchemaSchema,
  updateAchievementSchemaSchema,
  upsertTiersSchema,
  createKpiMasterSchema,
  updateKpiMasterSchema,
  createAssignmentSchema,
  updateAssignmentSchema,
  createCommissionPolicySchema,
  updateCommissionPolicySchema,
  finalizeResultSchema,
  runStagePayoutSchema,
  createAwardSchema,
  updateAwardSchema,
  createAwardWinnerSchema,
  updateAwardWinnerSchema,
} from "@/lib/validations/kpiInsentif";

// ─── KpiCalculationOutput type (defined here; imported by calculation engine) ─

export interface KpiCalculationOutput {
  realDealingTotal?: number | null;
  realDealingReguler?: number | null;
  realDealingHadjatan?: number | null;
  realOmsetTotal?: string | null;
  realOmsetReguler?: string | null;
  realOmsetHadjatan?: string | null;
  realHomebase?: number | null;
  targetDealingTotal?: number | null;
  targetOmsetTotal?: string | null;
  targetHomebase?: number | null;
  dealingAchievementPct?: string | null;
  omsetAchievementPct?: string | null;
  homebaseAchievementPct?: string | null;
  dealingTierId?: string | null;
  omsetTierId?: string | null;
  homebaseTierId?: string | null;
  dealingBonus?: string | null;
  omsetBonus?: string | null;
  homebaseBonus?: string | null;
  totalBonus?: string | null;
  baseCommissionReguler?: string | null;
  baseCommissionHadjatan?: string | null;
  baseCommissionTotal?: string | null;
  deductionTriggerIndicator?: string | null;
  deductionPct?: string | null;
  deductionAmount?: string | null;
  grossAmount?: string | null;
  netAmount?: string | null;
  grade?: string | null;
  missingDataReasons: string[];
  details: Array<{
    id?: string;
    indicatorType: "dealing" | "omset" | "homebase";
    targetValue?: string | null;
    realValue?: string | null;
    achievementPct?: string | null;
    tierId?: string | null;
    tierLabel?: string | null;
    actionType?: "bonus" | "deduction" | "warning" | "under_performance" | null;
    bonusAmount?: string | null;
    deductionPct?: string | null;
    isGatingFailed: boolean;
    notes?: string | null;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// ─── KpiTargetItem ────────────────────────────────────────────────────────────

export async function createTargetItem(data: unknown) {
  const { session, error } = await requirePermission({ module: "kpi-master", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`kpi-target-create:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = createTargetItemSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [item] = await db.$transaction([
      db.kpiTargetItem.create({ data: parsed.data }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "kpi_target_item.create",
      result: "success",
      entityType: "kpi_target_item",
      entityId: item.id,
      description: `Membuat KPI Target Item "${item.name}"`,
    });

    revalidateTag("kpi-insentif", "max");
    return { success: true, data: { id: item.id } };
  } catch (e) {
    console.error("[createTargetItem]", e);
    return { success: false, error: "Terjadi kesalahan saat menyimpan target item." };
  }
}

export async function updateTargetItem(id: string, data: unknown) {
  const { session, error } = await requirePermission({ module: "kpi-master", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`kpi-target-update:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = updateTargetItemSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [item] = await db.$transaction([
      db.kpiTargetItem.update({ where: { id }, data: parsed.data }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "kpi_target_item.update",
      result: "success",
      entityType: "kpi_target_item",
      entityId: id,
      description: `Memperbarui KPI Target Item "${item.name}"`,
    });

    revalidateTag("kpi-insentif", "max");
    return { success: true, data: { id: item.id } };
  } catch (e) {
    console.error("[updateTargetItem]", e);
    return { success: false, error: "Terjadi kesalahan saat memperbarui target item." };
  }
}

export async function deleteTargetItem(id: string) {
  const { session, error } = await requirePermission({ module: "kpi-master", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`kpi-target-delete:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  // Guard: FK check before delete to return a friendly error
  const refCount = await db.kpiMaster.count({ where: { targetItemId: id } });
  if (refCount > 0) {
    return {
      success: false,
      error: `Target item ini masih digunakan oleh ${refCount} KPI Master dan tidak dapat dihapus.`,
    };
  }

  try {
    const [item] = await db.$transaction([
      db.kpiTargetItem.delete({ where: { id } }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "kpi_target_item.delete",
      result: "success",
      entityType: "kpi_target_item",
      entityId: id,
      description: `Menghapus KPI Target Item "${item.name}"`,
    });

    revalidateTag("kpi-insentif", "max");
    return { success: true, data: { id } };
  } catch (e) {
    console.error("[deleteTargetItem]", e);
    return { success: false, error: "Terjadi kesalahan saat menghapus target item." };
  }
}

// ─── KpiAchievementSchema ─────────────────────────────────────────────────────

export async function createAchievementSchema(data: unknown) {
  const { session, error } = await requirePermission({ module: "kpi-master", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`kpi-schema-create:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = createAchievementSchemaSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [schema] = await db.$transaction([
      db.kpiAchievementSchema.create({ data: parsed.data }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "kpi_achievement_schema.create",
      result: "success",
      entityType: "kpi_achievement_schema",
      entityId: schema.id,
      description: `Membuat KPI Achievement Schema "${schema.name}"`,
    });

    revalidateTag("kpi-insentif", "max");
    return { success: true, data: { id: schema.id } };
  } catch (e) {
    console.error("[createAchievementSchema]", e);
    return { success: false, error: "Terjadi kesalahan saat menyimpan skema achievement." };
  }
}

export async function updateAchievementSchema(id: string, data: unknown) {
  const { session, error } = await requirePermission({ module: "kpi-master", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`kpi-schema-update:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = updateAchievementSchemaSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [schema] = await db.$transaction([
      db.kpiAchievementSchema.update({ where: { id }, data: parsed.data }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "kpi_achievement_schema.update",
      result: "success",
      entityType: "kpi_achievement_schema",
      entityId: id,
      description: `Memperbarui KPI Achievement Schema "${schema.name}"`,
    });

    revalidateTag("kpi-insentif", "max");
    return { success: true, data: { id: schema.id } };
  } catch (e) {
    console.error("[updateAchievementSchema]", e);
    return { success: false, error: "Terjadi kesalahan saat memperbarui skema achievement." };
  }
}

/**
 * Create or update an AchievementSchema and replace all its tiers atomically.
 * When `data.achievementSchemaId` refers to an existing schema, that schema is
 * updated; otherwise only tiers are upserted (schema must exist).
 */
export async function upsertSchemaWithTiers(data: unknown) {
  const { session, error } = await requirePermission({ module: "kpi-master", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`kpi-schema-tiers:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = upsertTiersSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { achievementSchemaId, tiers } = parsed.data;

  try {
    // Build tier create operations (delete-all-then-recreate pattern for array form)
    const deleteOld = db.kpiAchievementTier.deleteMany({
      where: { achievementSchemaId },
    });

    const createOps = tiers.map((tier) =>
      db.kpiAchievementTier.create({
        data: {
          achievementSchemaId,
          sortOrder: tier.sortOrder,
          label: tier.label,
          lowerBound: tier.lowerBound,
          upperBound: tier.upperBound ?? null,
          lowerInclusive: tier.lowerInclusive,
          upperInclusive: tier.upperInclusive,
          isDraftBounds: tier.isDraftBounds,
          actionType: tier.actionType,
          dealingBonus: tier.dealingBonus ?? null,
          omsetBonus: tier.omsetBonus ?? null,
          homebaseBonus: tier.homebaseBonus ?? null,
          deductionPct: tier.deductionPct ?? null,
          isWarningFlag: tier.isWarningFlag,
        },
      })
    );

    await db.$transaction([deleteOld, ...createOps]);

    await logAudit({
      userId: session!.user.id,
      action: "kpi_achievement_schema.upsert_tiers",
      result: "success",
      entityType: "kpi_achievement_schema",
      entityId: achievementSchemaId,
      description: `Mengganti ${tiers.length} tier pada skema ${achievementSchemaId}`,
    });

    revalidateTag("kpi-insentif", "max");
    return { success: true, data: { id: achievementSchemaId } };
  } catch (e) {
    console.error("[upsertSchemaWithTiers]", e);
    return { success: false, error: "Terjadi kesalahan saat menyimpan tier." };
  }
}

export async function deleteAchievementSchema(id: string) {
  const { session, error } = await requirePermission({ module: "kpi-master", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`kpi-schema-delete:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  // Guard FK
  const refCount = await db.kpiMaster.count({ where: { achievementSchemaId: id } });
  if (refCount > 0) {
    return {
      success: false,
      error: `Skema ini masih digunakan oleh ${refCount} KPI Master dan tidak dapat dihapus.`,
    };
  }

  try {
    // Delete tiers first (FK constraint), then schema
    await db.$transaction([
      db.kpiAchievementTier.deleteMany({ where: { achievementSchemaId: id } }),
      db.kpiAchievementSchema.delete({ where: { id } }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "kpi_achievement_schema.delete",
      result: "success",
      entityType: "kpi_achievement_schema",
      entityId: id,
      description: `Menghapus KPI Achievement Schema ${id}`,
    });

    revalidateTag("kpi-insentif", "max");
    return { success: true, data: { id } };
  } catch (e) {
    console.error("[deleteAchievementSchema]", e);
    return { success: false, error: "Terjadi kesalahan saat menghapus skema achievement." };
  }
}

// ─── KpiMaster ────────────────────────────────────────────────────────────────

export async function createKpiMaster(data: unknown) {
  const { session, error } = await requirePermission({ module: "kpi-master", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`kpi-master-create:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = createKpiMasterSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const createdById = session!.user.profileId ?? null;

  try {
    const [master] = await db.$transaction([
      db.kpiMaster.create({
        data: {
          ...parsed.data,
          month: firstOfMonth(parsed.data.month),
          createdById,
        },
      }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "kpi_master.create",
      result: "success",
      entityType: "kpi_master",
      entityId: master.id,
      description: `Membuat KPI Master "${master.name}"`,
    });

    revalidateTag("kpi-insentif", "max");
    return { success: true, data: { id: master.id } };
  } catch (e) {
    console.error("[createKpiMaster]", e);
    return { success: false, error: "Terjadi kesalahan saat menyimpan KPI Master." };
  }
}

export async function updateKpiMaster(id: string, data: unknown) {
  const { session, error } = await requirePermission({ module: "kpi-master", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`kpi-master-update:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = updateKpiMasterSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const updateData = {
    ...parsed.data,
    ...(parsed.data.month ? { month: firstOfMonth(parsed.data.month) } : {}),
  };

  try {
    const [master] = await db.$transaction([
      db.kpiMaster.update({ where: { id }, data: updateData }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "kpi_master.update",
      result: "success",
      entityType: "kpi_master",
      entityId: id,
      description: `Memperbarui KPI Master "${master.name}"`,
    });

    revalidateTag("kpi-insentif", "max");
    return { success: true, data: { id: master.id } };
  } catch (e) {
    console.error("[updateKpiMaster]", e);
    return { success: false, error: "Terjadi kesalahan saat memperbarui KPI Master." };
  }
}

export async function deleteKpiMaster(id: string) {
  const { session, error } = await requirePermission({ module: "kpi-master", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`kpi-master-delete:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  // Guard FK
  const refCount = await db.kpiAssignment.count({ where: { kpiMasterId: id } });
  if (refCount > 0) {
    return {
      success: false,
      error: `KPI Master ini masih memiliki ${refCount} assignment dan tidak dapat dihapus.`,
    };
  }

  try {
    const [master] = await db.$transaction([
      db.kpiMaster.delete({ where: { id } }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "kpi_master.delete",
      result: "success",
      entityType: "kpi_master",
      entityId: id,
      description: `Menghapus KPI Master "${master.name}"`,
    });

    revalidateTag("kpi-insentif", "max");
    return { success: true, data: { id } };
  } catch (e) {
    console.error("[deleteKpiMaster]", e);
    return { success: false, error: "Terjadi kesalahan saat menghapus KPI Master." };
  }
}

// ─── KpiAssignment ────────────────────────────────────────────────────────────

export async function createAssignment(data: unknown) {
  const { session, error } = await requirePermission({ module: "kpi-assignment", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`kpi-assign-create:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = createAssignmentSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const createdById = session!.user.profileId ?? null;

  try {
    const [assignment] = await db.$transaction([
      db.kpiAssignment.create({
        data: {
          ...parsed.data,
          period: firstOfMonth(parsed.data.period),
          createdById,
        },
      }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "kpi_assignment.create",
      result: "success",
      entityType: "kpi_assignment",
      entityId: assignment.id,
      description: `Membuat KPI Assignment untuk profile ${assignment.profileId} periode ${assignment.period.toISOString().substring(0, 7)}`,
    });

    revalidateTag("kpi-insentif", "max");
    return { success: true, data: { id: assignment.id } };
  } catch (e) {
    // Catch unique constraint violation (kpiMasterId + profileId + period)
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return {
        success: false,
        error: "Assignment untuk sales, KPI Master, dan periode ini sudah ada.",
      };
    }
    console.error("[createAssignment]", e);
    return { success: false, error: "Terjadi kesalahan saat menyimpan assignment." };
  }
}

export async function updateAssignment(id: string, data: unknown) {
  const { session, error } = await requirePermission({ module: "kpi-assignment", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`kpi-assign-update:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = updateAssignmentSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const updateData = {
    ...parsed.data,
    ...(parsed.data.period ? { period: firstOfMonth(parsed.data.period) } : {}),
  };

  try {
    const [assignment] = await db.$transaction([
      db.kpiAssignment.update({ where: { id }, data: updateData }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "kpi_assignment.update",
      result: "success",
      entityType: "kpi_assignment",
      entityId: id,
      description: `Memperbarui KPI Assignment ${id}`,
    });

    revalidateTag("kpi-insentif", "max");
    return { success: true, data: { id: assignment.id } };
  } catch (e) {
    console.error("[updateAssignment]", e);
    return { success: false, error: "Terjadi kesalahan saat memperbarui assignment." };
  }
}

export async function deleteAssignment(id: string) {
  const { session, error } = await requirePermission({ module: "kpi-assignment", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`kpi-assign-delete:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  try {
    const [assignment] = await db.$transaction([
      db.kpiAssignment.delete({ where: { id } }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "kpi_assignment.delete",
      result: "success",
      entityType: "kpi_assignment",
      entityId: id,
      description: `Menghapus KPI Assignment ${id}`,
    });

    revalidateTag("kpi-insentif", "max");
    return { success: true, data: { id: assignment.id } };
  } catch (e) {
    console.error("[deleteAssignment]", e);
    return { success: false, error: "Terjadi kesalahan saat menghapus assignment." };
  }
}

// ─── KpiCommissionPolicy ──────────────────────────────────────────────────────

export async function createCommissionPolicy(data: unknown) {
  const { session, error } = await requirePermission({ module: "kpi-master", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`kpi-policy-create:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = createCommissionPolicySchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [policy] = await db.$transaction([
      db.kpiCommissionPolicy.create({ data: parsed.data }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "kpi_commission_policy.create",
      result: "success",
      entityType: "kpi_commission_policy",
      entityId: policy.id,
      description: `Membuat kebijakan komisi "${policy.name}"`,
    });

    revalidateTag("kpi-insentif", "max");
    return { success: true, data: { id: policy.id } };
  } catch (e) {
    console.error("[createCommissionPolicy]", e);
    return { success: false, error: "Terjadi kesalahan saat menyimpan kebijakan komisi." };
  }
}

export async function updateCommissionPolicy(id: string, data: unknown) {
  const { session, error } = await requirePermission({ module: "kpi-master", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`kpi-policy-update:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = updateCommissionPolicySchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [policy] = await db.$transaction([
      db.kpiCommissionPolicy.update({ where: { id }, data: parsed.data }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "kpi_commission_policy.update",
      result: "success",
      entityType: "kpi_commission_policy",
      entityId: id,
      description: `Memperbarui kebijakan komisi "${policy.name}"`,
    });

    revalidateTag("kpi-insentif", "max");
    return { success: true, data: { id: policy.id } };
  } catch (e) {
    console.error("[updateCommissionPolicy]", e);
    return { success: false, error: "Terjadi kesalahan saat memperbarui kebijakan komisi." };
  }
}

export async function deleteCommissionPolicy(id: string) {
  const { session, error } = await requirePermission({ module: "kpi-master", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`kpi-policy-delete:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  try {
    const [policy] = await db.$transaction([
      db.kpiCommissionPolicy.delete({ where: { id } }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "kpi_commission_policy.delete",
      result: "success",
      entityType: "kpi_commission_policy",
      entityId: id,
      description: `Menghapus kebijakan komisi "${policy.name}"`,
    });

    revalidateTag("kpi-insentif", "max");
    return { success: true, data: { id } };
  } catch (e) {
    console.error("[deleteCommissionPolicy]", e);
    return { success: false, error: "Terjadi kesalahan saat menghapus kebijakan komisi." };
  }
}

// ─── Simulation / Calculation Result ─────────────────────────────────────────

/**
 * Persist a simulation or draft calculation result.
 * Called by the simulation UI after the calculation engine runs in the browser/server component.
 * Status is DRAFT or SIMULATED — never FINALIZED here.
 */
export async function saveCalculationResult(data: {
  profileId: string;
  period: Date;
  venueId?: string;
  result: KpiCalculationOutput;
  status: "DRAFT" | "SIMULATED";
}) {
  const { session, error } = await requirePermission({
    module: "kpi-simulation",
    action: "run",
  });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`kpi-sim-save:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const period = firstOfMonth(data.period);
  const { result } = data;

  try {
    // Upsert by (profileId, period, venueId) unique constraint
    const existing = await db.kpiCalculationResult.findFirst({
      where: {
        profileId: data.profileId,
        period,
        venueId: data.venueId ?? null,
      },
      select: { id: true, status: true },
    });

    // Do not overwrite a FINALIZED result
    if (existing?.status === "FINALIZED") {
      return {
        success: false,
        error: "Hasil kalkulasi sudah difinalisasi dan tidak dapat diubah.",
      };
    }

    const resultData = {
      profileId: data.profileId,
      venueId: data.venueId ?? null,
      period,
      status: data.status,
      realDealingTotal: result.realDealingTotal ?? null,
      realDealingReguler: result.realDealingReguler ?? null,
      realDealingHadjatan: result.realDealingHadjatan ?? null,
      realOmsetTotal: result.realOmsetTotal ?? null,
      realOmsetReguler: result.realOmsetReguler ?? null,
      realOmsetHadjatan: result.realOmsetHadjatan ?? null,
      realHomebase: result.realHomebase ?? null,
      targetDealingTotal: result.targetDealingTotal ?? null,
      targetOmsetTotal: result.targetOmsetTotal ?? null,
      targetHomebase: result.targetHomebase ?? null,
      dealingAchievementPct: result.dealingAchievementPct ?? null,
      omsetAchievementPct: result.omsetAchievementPct ?? null,
      homebaseAchievementPct: result.homebaseAchievementPct ?? null,
      dealingTierId: result.dealingTierId ?? null,
      omsetTierId: result.omsetTierId ?? null,
      homebaseTierId: result.homebaseTierId ?? null,
      dealingBonus: result.dealingBonus ?? null,
      omsetBonus: result.omsetBonus ?? null,
      homebaseBonus: result.homebaseBonus ?? null,
      totalBonus: result.totalBonus ?? null,
      baseCommissionReguler: result.baseCommissionReguler ?? null,
      baseCommissionHadjatan: result.baseCommissionHadjatan ?? null,
      baseCommissionTotal: result.baseCommissionTotal ?? null,
      deductionTriggerIndicator: result.deductionTriggerIndicator ?? null,
      deductionPct: result.deductionPct ?? null,
      deductionAmount: result.deductionAmount ?? null,
      grossAmount: result.grossAmount ?? null,
      netAmount: result.netAmount ?? null,
      grade: result.grade ?? null,
      missingDataReasons: result.missingDataReasons,
      calculatedAt: new Date(),
    };

    let resultId: string;

    if (existing) {
      // Update and delete old details
      await db.$transaction([
        db.kpiCalculationResult.update({ where: { id: existing.id }, data: resultData }),
        db.kpiCalculationDetail.deleteMany({ where: { resultId: existing.id } }),
        ...result.details.map((d) =>
          db.kpiCalculationDetail.create({
            data: {
              resultId: existing.id,
              indicatorType: d.indicatorType,
              targetValue: d.targetValue ?? null,
              realValue: d.realValue ?? null,
              achievementPct: d.achievementPct ?? null,
              tierId: d.tierId ?? null,
              tierLabel: d.tierLabel ?? null,
              actionType: d.actionType ?? null,
              bonusAmount: d.bonusAmount ?? null,
              deductionPct: d.deductionPct ?? null,
              isGatingFailed: d.isGatingFailed,
              notes: d.notes ?? null,
            },
          })
        ),
      ]);
      resultId = existing.id;
    } else {
      // Create new
      const [newResult] = await db.$transaction([
        db.kpiCalculationResult.create({ data: resultData }),
      ]);
      resultId = newResult.id;

      if (result.details.length > 0) {
        await db.$transaction(
          result.details.map((d) =>
            db.kpiCalculationDetail.create({
              data: {
                resultId,
                indicatorType: d.indicatorType,
                targetValue: d.targetValue ?? null,
                realValue: d.realValue ?? null,
                achievementPct: d.achievementPct ?? null,
                tierId: d.tierId ?? null,
                tierLabel: d.tierLabel ?? null,
                actionType: d.actionType ?? null,
                bonusAmount: d.bonusAmount ?? null,
                deductionPct: d.deductionPct ?? null,
                isGatingFailed: d.isGatingFailed,
                notes: d.notes ?? null,
              },
            })
          )
        );
      }
    }

    await logAudit({
      userId: session!.user.id,
      action: "kpi_calculation_result.save",
      result: "success",
      entityType: "kpi_calculation_result",
      entityId: resultId,
      description: `Menyimpan hasil simulasi KPI untuk profile ${data.profileId} periode ${period.toISOString().substring(0, 7)}`,
    });

    revalidateTag("kpi-insentif", "max");
    return { success: true, data: { id: resultId } };
  } catch (e) {
    console.error("[saveCalculationResult]", e);
    return { success: false, error: "Terjadi kesalahan saat menyimpan hasil kalkulasi." };
  }
}

/**
 * Finalize a calculation result:
 * - Blocks if already FINALIZED (idempotent guard)
 * - Blocks if missingDataReasons is non-empty
 * - Creates a KpiPolicySnapshot with full schema + tiers + active commission policy
 * - Sets status = FINALIZED, finalizedAt, finalizedById
 */
export async function finalizeResult(resultId: string) {
  const { session, error } = await requirePermission({
    module: "kpi-insentif",
    action: "finalize",
  });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`kpi-finalize:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = finalizeResultSchema.safeParse({ resultId });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    // Load the result with enough context to build the snapshot
    const result = await db.kpiCalculationResult.findUnique({
      where: { id: resultId },
      select: {
        id: true,
        status: true,
        missingDataReasons: true,
        profileId: true,
        period: true,
      },
    });

    if (!result) return { success: false, error: "Hasil kalkulasi tidak ditemukan." };
    if (result.status === "FINALIZED") {
      return { success: false, error: "Hasil kalkulasi sudah difinalisasi sebelumnya." };
    }
    if (result.missingDataReasons.length > 0) {
      return {
        success: false,
        error: `Tidak dapat finalisasi: data belum lengkap (${result.missingDataReasons.join(", ")}).`,
      };
    }

    // Trace back the assignment to get the master + schema + target. Must
    // match the result's own period exactly — NOT just the profile's most
    // recent assignment — otherwise the finalized snapshot can capture the
    // wrong period's policy when a profile has assignments spanning
    // multiple periods (mirrors the period filter runAutoCalculation uses).
    const matchingAssignment = await db.kpiAssignment.findFirst({
      where: { profileId: result.profileId, period: result.period, isDraft: false },
      select: {
        id: true,
        kpiMaster: {
          select: {
            id: true,
            name: true,
            achievementSchema: {
              select: {
                id: true,
                name: true,
                businessRole: true,
                isDraft: true,
                gatingMinIndicators: true,
                tiers: {
                  select: {
                    id: true,
                    sortOrder: true,
                    label: true,
                    lowerBound: true,
                    upperBound: true,
                    lowerInclusive: true,
                    upperInclusive: true,
                    isDraftBounds: true,
                    actionType: true,
                    dealingBonus: true,
                    omsetBonus: true,
                    homebaseBonus: true,
                    deductionPct: true,
                    isWarningFlag: true,
                  },
                  orderBy: { sortOrder: "asc" },
                },
              },
            },
            targetItem: {
              select: {
                id: true,
                name: true,
                dealingQty: true,
                omsetPrice: true,
                homebaseQty: true,
              },
            },
          },
        },
      },
    });

    const kpiMaster = matchingAssignment?.kpiMaster ?? null;
    if (kpiMaster?.achievementSchema?.isDraft) {
      return {
        success: false,
        error: "Skema KPI masih berstatus draft dan belum dapat difinalisasi.",
      };
    }
    if (kpiMaster?.achievementSchema?.tiers.some((tier) => tier.isDraftBounds)) {
      return {
        success: false,
        error: "Batas tier KPI masih menunggu keputusan kebijakan.",
      };
    }

    // Fetch active commission policy for the period
    const activeCommissionPolicy = await db.kpiCommissionPolicy.findFirst({
      where: {
        isDraft: false,
        OR: [
          { effectiveFrom: null },
          { effectiveFrom: { lte: result.period } },
        ],
        AND: [
          {
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: result.period } },
            ],
          },
        ],
      },
      orderBy: { effectiveFrom: "desc" },
      select: {
        id: true,
        name: true,
        businessRole: true,
        nominalPerDeal: true,
        pctOfRevenue: true,
        packageCategory: true,
        effectiveFrom: true,
        effectiveTo: true,
      },
    });

    // Build snapshot payload
    const snapshotData = {
      capturedAt: new Date().toISOString(),
      resultId: result.id,
      achievementSchema: kpiMaster?.achievementSchema ?? null,
      targetItem: kpiMaster?.targetItem ?? null,
      commissionPolicy: activeCommissionPolicy ?? null,
    };

    const profileId = session!.user.profileId ?? null;
    const now = new Date();

    // Atomic: create snapshot + update result
    const [snapshot] = await db.$transaction([
      db.kpiPolicySnapshot.create({
        data: {
          snapshotData,
          createdById: profileId,
        },
      }),
    ]);

    await db.$transaction([
      db.kpiCalculationResult.update({
        where: { id: resultId },
        data: {
          status: "FINALIZED",
          finalizedAt: now,
          finalizedById: profileId,
          policySnapshotId: snapshot.id,
        },
      }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "kpi_calculation_result.finalize",
      result: "success",
      entityType: "kpi_calculation_result",
      entityId: resultId,
      description: `Finalisasi hasil KPI ${resultId} untuk profile ${result.profileId}`,
    });

    revalidateTag("kpi-insentif", "max");
    return { success: true, data: { id: resultId } };
  } catch (e) {
    console.error("[finalizeResult]", e);
    return { success: false, error: "Terjadi kesalahan saat finalisasi hasil KPI." };
  }
}

/**
 * Auto-calculate KPI realization from actual booking data.
 * Pulls bookings (eventDate within period, all statuses except Canceled/Lost),
 * computes dealing/omset/homebase, loads assignment targets + achievement schema,
 * runs the calculation engine, and persists the result.
 */
export async function runAutoCalculation(data: {
  profileId: string;
  periodMonth: number;
  periodYear: number;
}) {
  const { session, error } = await requirePermission({
    module: "kpi-simulation",
    action: "run",
  });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`kpi-auto-calc:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const { profileId, periodMonth, periodYear } = data;
  if (!profileId || !periodMonth || !periodYear) {
    return { success: false, error: "Parameter tidak lengkap." };
  }

  const period = new Date(periodYear, periodMonth - 1, 1);
  const periodEnd = new Date(periodYear, periodMonth, 1);

  try {
    const [bookings, assignments, commissionPolicies] = await Promise.all([
      db.booking.findMany({
        where: {
          salesId: profileId,
          recordStatus: "saved",
          bookingStatus: { notIn: ["Canceled", "Lost"] },
          eventDate: { gte: period, lt: periodEnd },
        },
        select: {
          id: true,
          category: true,
          venueId: true,
          discountAmount: true,
          snapPackagePricing: { select: { price: true } },
          package: { select: { sellingPrice: true } },
        },
        take: 10000,
      }),
      db.kpiAssignment.findMany({
        where: { profileId, period, isDraft: false },
        select: {
          targetQty: true,
          targetPrice: true,
          kpiMaster: {
            select: {
              businessRole: true,
              achievementSchema: {
                select: {
                  id: true,
                  businessRole: true,
                  isDraft: true,
                  gatingMinIndicators: true,
                  stagedPaymentEnabled: true,
                  stage1PayoutPct: true,
                  stage2PayoutPct: true,
                  stage1MinClientPayment: true,
                  tiers: {
                    select: {
                      id: true,
                      label: true,
                      lowerBound: true,
                      upperBound: true,
                      lowerInclusive: true,
                      upperInclusive: true,
                      isDraftBounds: true,
                      actionType: true,
                      dealingBonus: true,
                      omsetBonus: true,
                      homebaseBonus: true,
                      deductionPct: true,
                      isWarningFlag: true,
                    },
                    orderBy: { sortOrder: "asc" },
                  },
                },
              },
              targetItem: {
                select: { dealingQty: true, omsetPrice: true, homebaseQty: true },
              },
            },
          },
        },
      }),
      db.kpiCommissionPolicy.findMany({
        where: {
          isDraft: false,
          OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: period } }],
          AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gte: period } }] }],
        },
        select: {
          id: true,
          businessRole: true,
          isDraft: true,
          nominalPerDeal: true,
          pctOfRevenue: true,
          packageCategory: true,
          effectiveFrom: true,
          effectiveTo: true,
          overAchievementNominalPerExtraDeal: true,
          overAchievementPctOfExtraRevenue: true,
        },
      }),
    ]);

    // ── Compute realization from bookings ────────────────────────────────────
    // homebaseVenueIds: query separately with fallback — table may not exist yet (pending migration)
    let homebaseVenueIds: string[] = [];
    try {
      const profileGroup = await db.userGroupMember.findFirst({
        where: { userId: profileId },
        select: { group: { select: { homebases: { select: { venueId: true } } } } },
      });
      homebaseVenueIds = profileGroup?.group?.homebases?.map((h) => h.venueId) ?? [];
    } catch {
      // table may not exist yet — homebase realization will be 0
    }

    let dealingTotal = 0;
    let dealingReguler = 0;
    let dealingHadjatan = 0;
    let omsetTotal = new Decimal(0);
    let omsetReguler = new Decimal(0);
    let omsetHadjatan = new Decimal(0);
    let realHomebase = 0;
    const bookingDeals: { bookingId: string; dealAmount: Decimal; category: "WEDDINGS" | "MICE" }[] = [];

    for (const b of bookings) {
      const rawPrice =
        b.snapPackagePricing?.price != null
          ? Number(b.snapPackagePricing.price)
          : Math.max(0, (b.package?.sellingPrice ?? 0) - b.discountAmount);
      const price = new Decimal(rawPrice);

      dealingTotal++;
      omsetTotal = omsetTotal.add(price);
      bookingDeals.push({ bookingId: b.id, dealAmount: price, category: b.category as "WEDDINGS" | "MICE" });

      if (b.category === "WEDDINGS") {
        dealingReguler++;
        omsetReguler = omsetReguler.add(price);
      } else {
        dealingHadjatan++;
        omsetHadjatan = omsetHadjatan.add(price);
      }

      if (homebaseVenueIds.length > 0 && homebaseVenueIds.includes(b.venueId ?? "")) {
        realHomebase++;
      }
    }

    // Cumulative acked cash-in per booking (Ledger) — used to gate Tahap 1 eligibility.
    const ackedCashInByBooking = new Map<string, Decimal>();
    if (bookingDeals.length > 0) {
      const ledgerSums = await db.ledger.groupBy({
        by: ["bookingId"],
        where: {
          bookingId: { in: bookingDeals.map((d) => d.bookingId) },
          direction: "in",
          ackStatus: "acknowledged",
          voidedAt: null,
        },
        _sum: { amount: true },
      });
      for (const l of ledgerSums) {
        ackedCashInByBooking.set(l.bookingId, new Decimal(l._sum.amount ?? 0));
      }
    }

    const realization: KpiRealization = {
      dealingTotal,
      dealingReguler,
      dealingHadjatan,
      omsetTotal,
      omsetReguler,
      omsetHadjatan,
      homebase: realHomebase,
    };

    // ── Build target + schema from assignments ───────────────────────────────
    let dealingTarget: number | null = null;
    let omsetTargetDecimal: Decimal | null = null;
    let homebaseTarget: number | null = null;
    let businessRole: KpiBusinessRole = "sales";
    let schemaInput: AchievementSchemaInput | null = null;
    let stagedPaymentConfig: {
      stagedPaymentEnabled: boolean;
      stage1PayoutPct: Decimal | null;
      stage2PayoutPct: Decimal | null;
      stage1MinClientPayment: number | null;
    } | null = null;

    for (const asgn of assignments) {
      const ti = asgn.kpiMaster.targetItem;
      if (asgn.kpiMaster.achievementSchema && !schemaInput) {
        const s = asgn.kpiMaster.achievementSchema;
        businessRole = s.businessRole as KpiBusinessRole;
        stagedPaymentConfig = {
          stagedPaymentEnabled: s.stagedPaymentEnabled,
          stage1PayoutPct: s.stage1PayoutPct ? new Decimal(s.stage1PayoutPct.toString()) : null,
          stage2PayoutPct: s.stage2PayoutPct ? new Decimal(s.stage2PayoutPct.toString()) : null,
          stage1MinClientPayment: s.stage1MinClientPayment,
        };
        schemaInput = {
          id: s.id,
          businessRole: s.businessRole as KpiBusinessRole,
          isDraft: s.isDraft,
          gatingMinIndicators: s.gatingMinIndicators,
          tiers: s.tiers.map((t) => ({
            id: t.id,
            label: t.label,
            lowerBound: new Decimal(t.lowerBound.toString()),
            upperBound: t.upperBound ? new Decimal(t.upperBound.toString()) : null,
            lowerInclusive: t.lowerInclusive,
            upperInclusive: t.upperInclusive,
            isDraftBounds: t.isDraftBounds,
            actionType: t.actionType as KpiTierAction,
            dealingBonus: t.dealingBonus ? new Decimal(t.dealingBonus.toString()) : null,
            omsetBonus: t.omsetBonus ? new Decimal(t.omsetBonus.toString()) : null,
            homebaseBonus: t.homebaseBonus ? new Decimal(t.homebaseBonus.toString()) : null,
            deductionPct: t.deductionPct ? new Decimal(t.deductionPct.toString()) : null,
            isWarningFlag: t.isWarningFlag,
          })),
        };
      }

      // NOTE: assignment-level targetQty/targetPrice override is no longer consulted —
      // KpiTargetItem is now unified (one row = dealing+omset+homebase), so those two
      // generic scalar overrides can't unambiguously map to a specific indicator anymore.
      if (ti.dealingQty != null) dealingTarget = ti.dealingQty;
      if (ti.omsetPrice != null) omsetTargetDecimal = new Decimal(ti.omsetPrice.toString());
      if (ti.homebaseQty != null) homebaseTarget = ti.homebaseQty;
    }

    if (!schemaInput) {
      schemaInput = {
        id: "missing",
        businessRole: "sales",
        isDraft: true,
        gatingMinIndicators: null,
        tiers: [],
      };
    }

    const target: KpiTarget = {
      dealingTotal: dealingTarget,
      omsetTotal: omsetTargetDecimal,
      homebase: homebaseTarget,
    };

    // ── Run calculation engine ───────────────────────────────────────────────
    const calcResult = computeKpiResult({
      businessRole,
      realization,
      target,
      schema: schemaInput,
      commissionPolicies: commissionPolicies.map(
        (p): CommissionPolicyInput => ({
          id: p.id,
          businessRole: p.businessRole as KpiBusinessRole,
          isDraft: p.isDraft,
          nominalPerDeal: p.nominalPerDeal
            ? new Decimal(p.nominalPerDeal.toString())
            : null,
          pctOfRevenue: p.pctOfRevenue
            ? new Decimal(p.pctOfRevenue.toString())
            : null,
          packageCategory: p.packageCategory as "WEDDINGS" | "MICE" | null,
          effectiveFrom: p.effectiveFrom,
          effectiveTo: p.effectiveTo,
        })
      ),
      period,
    });

    // ── Over-achievement bonus (additive) ────────────────────────────────────
    const overAchievementPolicyRow =
      commissionPolicies.find(
        (p) =>
          p.overAchievementNominalPerExtraDeal !== null ||
          p.overAchievementPctOfExtraRevenue !== null
      ) ?? null;
    const overAchievement = computeOverAchievementBonus({
      realDealingTotal: dealingTotal,
      targetDealingTotal: dealingTarget,
      realOmsetTotal: omsetTotal,
      targetOmsetTotal: omsetTargetDecimal,
      policy: overAchievementPolicyRow
        ? {
            overAchievementNominalPerExtraDeal: overAchievementPolicyRow.overAchievementNominalPerExtraDeal
              ? new Decimal(overAchievementPolicyRow.overAchievementNominalPerExtraDeal.toString())
              : null,
            overAchievementPctOfExtraRevenue: overAchievementPolicyRow.overAchievementPctOfExtraRevenue
              ? new Decimal(overAchievementPolicyRow.overAchievementPctOfExtraRevenue.toString())
              : null,
          }
        : null,
    });

    // ── Staged payment (Tahap 1/2, additive) ─────────────────────────────────
    const stagedPaymentDeals: StagedPaymentDealInput[] = bookingDeals.map((d) => ({
      bookingId: d.bookingId,
      dealAmount: d.dealAmount,
      category: d.category,
      cumulativeAckedCashIn: ackedCashInByBooking.get(d.bookingId) ?? new Decimal(0),
      isCanceled: false, // bookings fetched here already exclude Canceled/Lost
    }));
    const stagedPayment = computeStagedPayment({
      totalBonus: calcResult.totalBonus,
      schema: stagedPaymentConfig ?? {
        stagedPaymentEnabled: false,
        stage1PayoutPct: null,
        stage2PayoutPct: null,
        stage1MinClientPayment: null,
      },
      deals: stagedPaymentDeals,
    });

    // ── Map to DB output format ──────────────────────────────────────────────
    const str = (d: Decimal | null | undefined): string | null =>
      d != null ? d.toFixed(2) : null;

    const output: KpiCalculationOutput = {
      realDealingTotal: dealingTotal,
      realDealingReguler: dealingReguler,
      realDealingHadjatan: dealingHadjatan,
      realOmsetTotal: omsetTotal.toFixed(2),
      realOmsetReguler: omsetReguler.toFixed(2),
      realOmsetHadjatan: omsetHadjatan.toFixed(2),
      realHomebase,
      targetDealingTotal: dealingTarget,
      targetOmsetTotal: str(omsetTargetDecimal),
      targetHomebase: homebaseTarget,
      dealingAchievementPct: str(calcResult.dealing.achievementPct),
      omsetAchievementPct: str(calcResult.omset.achievementPct),
      homebaseAchievementPct: str(calcResult.homebase.achievementPct),
      dealingTierId: calcResult.dealing.tierId,
      omsetTierId: calcResult.omset.tierId,
      homebaseTierId: calcResult.homebase.tierId,
      dealingBonus: str(calcResult.dealing.bonusAmount),
      omsetBonus: str(calcResult.omset.bonusAmount),
      homebaseBonus: str(calcResult.homebase.bonusAmount),
      totalBonus: str(calcResult.totalBonus),
      baseCommissionReguler: str(calcResult.baseCommissionReguler),
      baseCommissionHadjatan: str(calcResult.baseCommissionHadjatan),
      baseCommissionTotal: str(calcResult.baseCommissionTotal),
      deductionTriggerIndicator: calcResult.deductionTriggerIndicator,
      deductionPct: str(calcResult.deductionPct),
      deductionAmount: str(calcResult.deductionAmount),
      grossAmount: str(calcResult.grossAmount),
      netAmount: str(calcResult.netAmount),
      grade: calcResult.dealing.tierLabel ?? calcResult.omset.tierLabel ?? null,
      missingDataReasons: calcResult.missingDataReasons,
      details: [
        {
          indicatorType: "dealing",
          targetValue: str(calcResult.dealing.targetValue),
          realValue: calcResult.dealing.realValue?.toString() ?? null,
          achievementPct: str(calcResult.dealing.achievementPct),
          tierId: calcResult.dealing.tierId,
          tierLabel: calcResult.dealing.tierLabel,
          actionType: calcResult.dealing.actionType ?? null,
          bonusAmount: str(calcResult.dealing.bonusAmount),
          deductionPct: str(calcResult.dealing.deductionPct),
          isGatingFailed: calcResult.dealing.isGatingFailed,
          notes: calcResult.dealing.notes,
        },
        {
          indicatorType: "omset",
          targetValue: str(calcResult.omset.targetValue),
          realValue: calcResult.omset.realValue?.toString() ?? null,
          achievementPct: str(calcResult.omset.achievementPct),
          tierId: calcResult.omset.tierId,
          tierLabel: calcResult.omset.tierLabel,
          actionType: calcResult.omset.actionType ?? null,
          bonusAmount: str(calcResult.omset.bonusAmount),
          deductionPct: str(calcResult.omset.deductionPct),
          isGatingFailed: calcResult.omset.isGatingFailed,
          notes: calcResult.omset.notes,
        },
        {
          indicatorType: "homebase",
          targetValue: str(calcResult.homebase.targetValue),
          realValue: calcResult.homebase.realValue?.toString() ?? null,
          achievementPct: str(calcResult.homebase.achievementPct),
          tierId: calcResult.homebase.tierId,
          tierLabel: calcResult.homebase.tierLabel,
          actionType: calcResult.homebase.actionType ?? null,
          bonusAmount: str(calcResult.homebase.bonusAmount),
          deductionPct: str(calcResult.homebase.deductionPct),
          isGatingFailed: calcResult.homebase.isGatingFailed,
          notes: calcResult.homebase.notes,
        },
      ],
    };

    // ── Upsert result to DB ──────────────────────────────────────────────────
    const resultStatus = (calcResult.status === "ok" ? "SIMULATED" : "DRAFT") as "SIMULATED" | "DRAFT";

    const existing = await db.kpiCalculationResult.findFirst({
      where: { profileId, period, venueId: null },
      select: { id: true, status: true },
    });

    if (existing?.status === "FINALIZED") {
      return {
        success: false,
        error: "Hasil kalkulasi sudah difinalisasi dan tidak dapat diubah.",
      };
    }

    const resultData = {
      profileId,
      venueId: null as string | null,
      period,
      status: resultStatus,
      realDealingTotal: output.realDealingTotal ?? null,
      realDealingReguler: output.realDealingReguler ?? null,
      realDealingHadjatan: output.realDealingHadjatan ?? null,
      realOmsetTotal: output.realOmsetTotal ?? null,
      realOmsetReguler: output.realOmsetReguler ?? null,
      realOmsetHadjatan: output.realOmsetHadjatan ?? null,
      realHomebase: output.realHomebase ?? null,
      targetDealingTotal: output.targetDealingTotal ?? null,
      targetOmsetTotal: output.targetOmsetTotal ?? null,
      targetHomebase: output.targetHomebase ?? null,
      dealingAchievementPct: output.dealingAchievementPct ?? null,
      omsetAchievementPct: output.omsetAchievementPct ?? null,
      homebaseAchievementPct: output.homebaseAchievementPct ?? null,
      dealingTierId: output.dealingTierId ?? null,
      omsetTierId: output.omsetTierId ?? null,
      homebaseTierId: output.homebaseTierId ?? null,
      dealingBonus: output.dealingBonus ?? null,
      omsetBonus: output.omsetBonus ?? null,
      homebaseBonus: output.homebaseBonus ?? null,
      totalBonus: output.totalBonus ?? null,
      baseCommissionReguler: output.baseCommissionReguler ?? null,
      baseCommissionHadjatan: output.baseCommissionHadjatan ?? null,
      baseCommissionTotal: output.baseCommissionTotal ?? null,
      deductionTriggerIndicator: output.deductionTriggerIndicator ?? null,
      deductionPct: output.deductionPct ?? null,
      deductionAmount: output.deductionAmount ?? null,
      grossAmount: output.grossAmount ?? null,
      netAmount: output.netAmount ?? null,
      grade: output.grade ?? null,
      missingDataReasons: output.missingDataReasons,
      calculatedAt: new Date(),
      // ── Over-achievement bonus (additive, null = policy not configured) ──────
      overAchievementDealingBonus: str(overAchievement.dealingBonus),
      overAchievementOmsetBonus: str(overAchievement.omsetBonus),
      overAchievementTotal: str(overAchievement.total),
      // ── Staged payment (additive, null = feature not enabled on schema) ─────
      stage1Total: str(stagedPayment.stage1Total),
      stage2Total: str(stagedPayment.stage2Total),
      stage1EligibleAmount: str(stagedPayment.stage1EligibleAmount),
      stage2AdjustedAmount: str(stagedPayment.stage2AdjustedAmount),
      stage2ClawbackAmount: str(stagedPayment.stage2ClawbackAmount),
    };

    const dealLinkCreateOps = (resultId: string) =>
      stagedPayment.dealLinks.map((d) =>
        db.kpiCalculationDealLink.create({
          data: {
            resultId,
            bookingId: d.bookingId,
            dealAmount: d.dealAmount,
            category: d.category,
            stage1Share: d.stage1Share,
            stage2Share: d.stage2Share,
            stage1Eligible: d.stage1Eligible,
          },
        })
      );

    let resultId: string;

    if (existing) {
      await db.$transaction([
        db.kpiCalculationResult.update({ where: { id: existing.id }, data: resultData }),
        db.kpiCalculationDetail.deleteMany({ where: { resultId: existing.id } }),
        ...output.details.map((d) =>
          db.kpiCalculationDetail.create({
            data: {
              resultId: existing.id,
              indicatorType: d.indicatorType,
              targetValue: d.targetValue ?? null,
              realValue: d.realValue ?? null,
              achievementPct: d.achievementPct ?? null,
              tierId: d.tierId ?? null,
              tierLabel: d.tierLabel ?? null,
              actionType: d.actionType ?? null,
              bonusAmount: d.bonusAmount ?? null,
              deductionPct: d.deductionPct ?? null,
              isGatingFailed: d.isGatingFailed,
              notes: d.notes ?? null,
            },
          })
        ),
        db.kpiCalculationDealLink.deleteMany({ where: { resultId: existing.id } }),
        ...dealLinkCreateOps(existing.id),
      ]);
      resultId = existing.id;
    } else {
      const [newResult] = await db.$transaction([
        db.kpiCalculationResult.create({ data: resultData }),
      ]);
      resultId = newResult.id;
      if (output.details.length > 0) {
        await db.$transaction(
          output.details.map((d) =>
            db.kpiCalculationDetail.create({
              data: {
                resultId,
                indicatorType: d.indicatorType,
                targetValue: d.targetValue ?? null,
                realValue: d.realValue ?? null,
                achievementPct: d.achievementPct ?? null,
                tierId: d.tierId ?? null,
                tierLabel: d.tierLabel ?? null,
                actionType: d.actionType ?? null,
                bonusAmount: d.bonusAmount ?? null,
                deductionPct: d.deductionPct ?? null,
                isGatingFailed: d.isGatingFailed,
                notes: d.notes ?? null,
              },
            })
          )
        );
      }
      if (stagedPayment.dealLinks.length > 0) {
        await db.$transaction(dealLinkCreateOps(resultId));
      }
    }

    await logAudit({
      userId: session!.user.id,
      action: "kpi_calculation_result.auto_calculate",
      result: "success",
      entityType: "kpi_calculation_result",
      entityId: resultId,
      description: `Auto-kalkulasi KPI untuk profile ${profileId} periode ${period.toISOString().substring(0, 7)} (${dealingTotal} booking)`,
    });

    revalidateTag("kpi-insentif", "max");
    return { success: true, data: { id: resultId } };
  } catch (e) {
    console.error("[runAutoCalculation]", e);
    return { success: false, error: "Terjadi kesalahan saat kalkulasi otomatis." };
  }
}

// ─── Staged payment: recompute clawback + mark-paid ────────────────────────────

/**
 * Re-evaluate Tahap 2 clawback against LIVE booking status. Tahap 1 eligibility
 * (stage1Eligible per deal, frozen at calculation time) is never touched here —
 * only stage2AdjustedAmount/stage2ClawbackAmount are refreshed, since a booking
 * can be canceled any time after the initial KPI calculation (e.g. the month
 * after finalize, right before Tahap 2 payout).
 */
export async function recomputeStagedPayment(resultId: string) {
  const { session, error } = await requirePermission({
    module: "kpi-simulation",
    action: "run",
  });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`kpi-stage-recompute:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  try {
    const result = await db.kpiCalculationResult.findUnique({
      where: { id: resultId },
      select: {
        id: true,
        stage2Total: true,
        dealLinks: { select: { bookingId: true, stage2Share: true } },
      },
    });
    if (!result) return { success: false, error: "Hasil kalkulasi tidak ditemukan." };
    if (result.stage2Total === null) {
      return { success: false, error: "Pembayaran bertahap tidak dikonfigurasi untuk hasil ini." };
    }

    const bookingIds = result.dealLinks.map((d) => d.bookingId);
    const bookings = await db.booking.findMany({
      where: { id: { in: bookingIds } },
      select: { id: true, bookingStatus: true },
    });
    const canceledSet = new Set(
      bookings.filter((b) => b.bookingStatus === "Canceled").map((b) => b.id)
    );

    let stage2AdjustedAmount = new Decimal(0);
    for (const d of result.dealLinks) {
      if (d.stage2Share === null) continue;
      if (!canceledSet.has(d.bookingId)) {
        stage2AdjustedAmount = stage2AdjustedAmount.add(new Decimal(d.stage2Share.toString()));
      }
    }
    const stage2Total = new Decimal(result.stage2Total.toString());
    const stage2ClawbackAmount = stage2Total.sub(stage2AdjustedAmount);

    await db.$transaction([
      db.kpiCalculationResult.update({
        where: { id: resultId },
        data: {
          stage2AdjustedAmount: stage2AdjustedAmount.toFixed(2),
          stage2ClawbackAmount: stage2ClawbackAmount.toFixed(2),
        },
      }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "kpi_calculation_result.recompute_staged_payment",
      result: "success",
      entityType: "kpi_calculation_result",
      entityId: resultId,
      description: `Re-evaluasi clawback Tahap 2 untuk hasil KPI ${resultId}`,
    });

    revalidateTag("kpi-insentif", "max");
    return { success: true, data: { id: resultId } };
  } catch (e) {
    console.error("[recomputeStagedPayment]", e);
    return { success: false, error: "Terjadi kesalahan saat re-evaluasi pembayaran bertahap." };
  }
}

/**
 * Mark Tahap 1 or Tahap 2 as paid. Idempotent (blocks re-marking an already-paid
 * stage) and enforces payout order (Tahap 2 requires Tahap 1 paid first).
 */
export async function markStagePaid(resultId: string, stage: 1 | 2) {
  const { session, error } = await requirePermission({ module: "kpi-insentif", action: "pay" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`kpi-stage-pay:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = runStagePayoutSchema.safeParse({ resultId, stage });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const result = await db.kpiCalculationResult.findUnique({
      where: { id: resultId },
      select: { id: true, stage1Total: true, stage2Total: true, stage1PaidAt: true, stage2PaidAt: true },
    });
    if (!result) return { success: false, error: "Hasil kalkulasi tidak ditemukan." };

    const paidById = session!.user.profileId ?? null;
    const now = new Date();

    if (parsed.data.stage === 1) {
      if (result.stage1Total === null) {
        return { success: false, error: "Tahap 1 tidak dikonfigurasi untuk hasil ini." };
      }
      if (result.stage1PaidAt !== null) {
        return { success: false, error: "Tahap 1 sudah dibayar." };
      }
      await db.$transaction([
        db.kpiCalculationResult.update({
          where: { id: resultId },
          data: { stage1PaidAt: now, stage1PaidById: paidById },
        }),
      ]);
    } else {
      if (result.stage2Total === null) {
        return { success: false, error: "Tahap 2 tidak dikonfigurasi untuk hasil ini." };
      }
      if (result.stage1PaidAt === null) {
        return { success: false, error: "Tahap 1 harus dibayar terlebih dahulu." };
      }
      if (result.stage2PaidAt !== null) {
        return { success: false, error: "Tahap 2 sudah dibayar." };
      }
      await db.$transaction([
        db.kpiCalculationResult.update({
          where: { id: resultId },
          data: { stage2PaidAt: now, stage2PaidById: paidById },
        }),
      ]);
    }

    await logAudit({
      userId: session!.user.id,
      action: "kpi_calculation_result.mark_stage_paid",
      result: "success",
      entityType: "kpi_calculation_result",
      entityId: resultId,
      description: `Menandai Tahap ${parsed.data.stage} lunas untuk hasil KPI ${resultId}`,
    });

    revalidateTag("kpi-insentif", "max");
    return { success: true, data: { id: resultId, stage: parsed.data.stage } };
  } catch (e) {
    console.error("[markStagePaid]", e);
    return { success: false, error: "Terjadi kesalahan saat menandai pembayaran." };
  }
}

// ─── KpiAward ─────────────────────────────────────────────────────────────────

export async function createAward(data: unknown) {
  const { session, error } = await requirePermission({ module: "kpi-master", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`kpi-award-create:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = createAwardSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [award] = await db.$transaction([db.kpiAward.create({ data: parsed.data })]);

    await logAudit({
      userId: session!.user.id,
      action: "kpi_award.create",
      result: "success",
      entityType: "kpi_award",
      entityId: award.id,
      description: `Membuat KPI Award "${award.name}"`,
    });

    revalidateTag("kpi-insentif", "max");
    return { success: true, data: { id: award.id } };
  } catch (e) {
    console.error("[createAward]", e);
    return { success: false, error: "Terjadi kesalahan saat menyimpan award." };
  }
}

export async function updateAward(id: string, data: unknown) {
  const { session, error } = await requirePermission({ module: "kpi-master", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`kpi-award-update:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = updateAwardSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [award] = await db.$transaction([
      db.kpiAward.update({ where: { id }, data: parsed.data }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "kpi_award.update",
      result: "success",
      entityType: "kpi_award",
      entityId: id,
      description: `Memperbarui KPI Award "${award.name}"`,
    });

    revalidateTag("kpi-insentif", "max");
    return { success: true, data: { id: award.id } };
  } catch (e) {
    console.error("[updateAward]", e);
    return { success: false, error: "Terjadi kesalahan saat memperbarui award." };
  }
}

export async function deleteAward(id: string) {
  const { session, error } = await requirePermission({ module: "kpi-master", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`kpi-award-delete:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const refCount = await db.kpiAwardWinner.count({ where: { awardId: id } });
  if (refCount > 0) {
    return {
      success: false,
      error: `Award ini masih memiliki ${refCount} pemenang dan tidak dapat dihapus.`,
    };
  }

  try {
    const [award] = await db.$transaction([db.kpiAward.delete({ where: { id } })]);

    await logAudit({
      userId: session!.user.id,
      action: "kpi_award.delete",
      result: "success",
      entityType: "kpi_award",
      entityId: id,
      description: `Menghapus KPI Award "${award.name}"`,
    });

    revalidateTag("kpi-insentif", "max");
    return { success: true, data: { id } };
  } catch (e) {
    console.error("[deleteAward]", e);
    return { success: false, error: "Terjadi kesalahan saat menghapus award." };
  }
}

// ─── KpiAwardWinner ───────────────────────────────────────────────────────────

export async function createAwardWinner(data: unknown) {
  const { session, error } = await requirePermission({ module: "kpi-award", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`kpi-award-winner-create:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = createAwardWinnerSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const awardedById = session!.user.profileId ?? null;
  const period = firstOfMonth(parsed.data.period);

  // No unique constraint on (awardId, period, profileId/groupId) at the schema
  // level (XOR winner target, same pattern as the rest of this project) — guard
  // duplicate winners at the application layer instead.
  const duplicate = await db.kpiAwardWinner.findFirst({
    where: {
      awardId: parsed.data.awardId,
      period,
      ...(parsed.data.profileId ? { profileId: parsed.data.profileId } : {}),
      ...(parsed.data.groupId ? { groupId: parsed.data.groupId } : {}),
    },
    select: { id: true },
  });
  if (duplicate) {
    return {
      success: false,
      error: "Profile/tim ini sudah ditetapkan sebagai pemenang award ini untuk periode yang sama.",
    };
  }

  try {
    const [winner] = await db.$transaction([
      db.kpiAwardWinner.create({
        data: {
          awardId: parsed.data.awardId,
          period,
          profileId: parsed.data.profileId ?? null,
          groupId: parsed.data.groupId ?? null,
          prizeDescription: parsed.data.prizeDescription ?? null,
          rankValueSnapshot: parsed.data.rankValueSnapshot ?? null,
          notes: parsed.data.notes ?? null,
          awardedById,
        },
      }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "kpi_award_winner.create",
      result: "success",
      entityType: "kpi_award_winner",
      entityId: winner.id,
      description: `Menetapkan pemenang award ${winner.awardId} periode ${winner.period.toISOString().substring(0, 7)}`,
    });

    revalidateTag("kpi-insentif", "max");
    return { success: true, data: { id: winner.id } };
  } catch (e) {
    console.error("[createAwardWinner]", e);
    return { success: false, error: "Terjadi kesalahan saat menyimpan pemenang award." };
  }
}

export async function updateAwardWinner(id: string, data: unknown) {
  const { session, error } = await requirePermission({ module: "kpi-award", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`kpi-award-winner-update:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = updateAwardWinnerSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const updateData = {
    ...parsed.data,
    ...(parsed.data.period ? { period: firstOfMonth(parsed.data.period) } : {}),
  };

  if (parsed.data.awardId || parsed.data.period || parsed.data.profileId || parsed.data.groupId) {
    const existing = await db.kpiAwardWinner.findUnique({
      where: { id },
      select: { awardId: true, period: true, profileId: true, groupId: true },
    });
    if (!existing) return { success: false, error: "Data pemenang tidak ditemukan." };

    const nextAwardId = parsed.data.awardId ?? existing.awardId;
    const nextPeriod = updateData.period ?? existing.period;
    const nextProfileId = parsed.data.profileId !== undefined ? parsed.data.profileId : existing.profileId;
    const nextGroupId = parsed.data.groupId !== undefined ? parsed.data.groupId : existing.groupId;

    const duplicate = await db.kpiAwardWinner.findFirst({
      where: {
        id: { not: id },
        awardId: nextAwardId,
        period: nextPeriod,
        ...(nextProfileId ? { profileId: nextProfileId } : {}),
        ...(nextGroupId ? { groupId: nextGroupId } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      return {
        success: false,
        error: "Profile/tim ini sudah ditetapkan sebagai pemenang award ini untuk periode yang sama.",
      };
    }
  }

  try {
    const [winner] = await db.$transaction([
      db.kpiAwardWinner.update({ where: { id }, data: updateData }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "kpi_award_winner.update",
      result: "success",
      entityType: "kpi_award_winner",
      entityId: id,
      description: `Memperbarui pemenang award ${winner.awardId}`,
    });

    revalidateTag("kpi-insentif", "max");
    return { success: true, data: { id: winner.id } };
  } catch (e) {
    console.error("[updateAwardWinner]", e);
    return { success: false, error: "Terjadi kesalahan saat memperbarui pemenang award." };
  }
}

export async function deleteAwardWinner(id: string) {
  const { session, error } = await requirePermission({ module: "kpi-award", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`kpi-award-winner-delete:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  try {
    const [winner] = await db.$transaction([db.kpiAwardWinner.delete({ where: { id } })]);

    await logAudit({
      userId: session!.user.id,
      action: "kpi_award_winner.delete",
      result: "success",
      entityType: "kpi_award_winner",
      entityId: id,
      description: `Menghapus pemenang award ${winner.awardId}`,
    });

    revalidateTag("kpi-insentif", "max");
    return { success: true, data: { id } };
  } catch (e) {
    console.error("[deleteAwardWinner]", e);
    return { success: false, error: "Terjadi kesalahan saat menghapus pemenang award." };
  }
}
