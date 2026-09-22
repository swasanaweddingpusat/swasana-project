// FILE: actions/kpiInsentif.ts
"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { Decimal } from "@prisma/client/runtime/client";
import {
  computeKpiResult,
  type KpiRealization,
  type KpiTarget,
  type AchievementSchemaInput,
  type KpiTierAction,
  type KpiBusinessRole,
  type CommissionPolicyInput,
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
                indicatorType: true,
                type: true,
                qty: true,
                price: true,
              },
            },
          },
        },
      },
    });

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
    const kpiMaster = matchingAssignment?.kpiMaster ?? null;
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
                select: { indicatorType: true, qty: true, price: true },
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

    for (const b of bookings) {
      const rawPrice =
        b.snapPackagePricing?.price != null
          ? Number(b.snapPackagePricing.price)
          : Math.max(0, (b.package?.sellingPrice ?? 0) - b.discountAmount);
      const price = new Decimal(rawPrice);

      dealingTotal++;
      omsetTotal = omsetTotal.add(price);

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

    for (const asgn of assignments) {
      const ti = asgn.kpiMaster.targetItem;
      if (asgn.kpiMaster.achievementSchema && !schemaInput) {
        const s = asgn.kpiMaster.achievementSchema;
        businessRole = s.businessRole as KpiBusinessRole;
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

      if (ti.indicatorType === "dealing") {
        dealingTarget = asgn.targetQty ?? ti.qty ?? null;
      } else if (ti.indicatorType === "omset") {
        const raw = asgn.targetPrice ?? ti.price;
        omsetTargetDecimal = raw != null ? new Decimal(raw.toString()) : null;
      } else if (ti.indicatorType === "homebase") {
        homebaseTarget = asgn.targetQty ?? ti.qty ?? null;
      }
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
    };

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
