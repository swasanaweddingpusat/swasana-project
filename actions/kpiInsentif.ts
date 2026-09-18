// FILE: actions/kpiInsentif.ts
"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
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
        // We need to trace back the assignment to get the master + schema + target
        profile: {
          select: {
            kpiAssignments: {
              where: { isDraft: false },
              orderBy: { period: "desc" },
              take: 1,
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
            },
          },
        },
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
    const kpiMaster = result.profile.kpiAssignments[0]?.kpiMaster ?? null;
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
