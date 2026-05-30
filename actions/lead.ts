"use server";

import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import {
  createLeadSchema,
  updateLeadSchema,
  updateLeadStatusSchema,
} from "@/lib/validations/lead";
import type { CreateLeadInput, UpdateLeadInput, UpdateLeadStatusInput } from "@/lib/validations/lead";
import type { Prisma } from "@prisma/client";

// ─── Create Lead ──────────────────────────────────────────────────────────────

export async function createLead(data: CreateLeadInput) {
  const permResult = await requirePermission({ module: "leads", action: "create" });
  if (permResult.error) return { success: false as const, error: permResult.error };
  const session = permResult.session!;

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown";

  if (!mutationLimiter.check(`create-lead:${session.user.id}`)) {
    return { success: false as const, ...rateLimitError() };
  }

  const parsed = createLeadSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0].message };
  }

  const {
    name,
    contactNumbers,
    email,
    eventDate,
    estimatedPax,
    budgetRange,
    notes,
    venueId,
    packageId,
    eventTypeId,
    sourceOfInformationId,
    assignedToId,
    statusId,
  } = parsed.data;

  try {
    const [lead] = await db.$transaction([
      db.lead.create({
        data: {
          name,
          contactNumbers,
          email: email || null,
          eventDate: eventDate ? new Date(eventDate) : null,
          estimatedPax: estimatedPax ?? null,
          budgetRange: budgetRange || null,
          notes: notes || null,
          venueId: venueId || null,
          packageId: packageId || null,
          eventTypeId: eventTypeId || null,
          sourceOfInformationId: sourceOfInformationId || null,
          assignedToId: assignedToId || null,
          statusId,
          createdById: session.user.profileId,
        },
        select: { id: true, name: true },
      }),
    ]);

    await logAudit({
      userId: session.user.profileId,
      action: "lead.created",
      result: "success",
      entityType: "Lead",
      entityId: lead.id,
      ipAddress: ip,
    });

    revalidateTag("leads", "max");

    return { success: true as const, data: lead };
  } catch (err) {
    console.error("[createLead]", err);
    return { success: false as const, error: "Gagal menyimpan lead." };
  }
}

// ─── Update Lead ──────────────────────────────────────────────────────────────

export async function updateLead(data: UpdateLeadInput) {
  const permResult = await requirePermission({ module: "leads", action: "edit" });
  if (permResult.error) return { success: false as const, error: permResult.error };
  const session = permResult.session!;

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown";

  if (!mutationLimiter.check(`update-lead:${session.user.id}`)) {
    return { success: false as const, ...rateLimitError() };
  }

  const parsed = updateLeadSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0].message };
  }

  const { id, ...fields } = parsed.data;

  try {
    const [lead] = await db.$transaction([
      db.lead.update({
        where: { id },
        data: {
          ...(fields.name !== undefined && { name: fields.name }),
          ...(fields.contactNumbers !== undefined && { contactNumbers: fields.contactNumbers }),
          ...(fields.email !== undefined && { email: fields.email || null }),
          ...(fields.eventDate !== undefined && {
            eventDate: fields.eventDate ? new Date(fields.eventDate) : null,
          }),
          ...(fields.estimatedPax !== undefined && { estimatedPax: fields.estimatedPax ?? null }),
          ...(fields.budgetRange !== undefined && { budgetRange: fields.budgetRange || null }),
          ...(fields.notes !== undefined && { notes: fields.notes || null }),
          ...(fields.venueId !== undefined && { venueId: fields.venueId || null }),
          ...(fields.packageId !== undefined && { packageId: fields.packageId || null }),
          ...(fields.eventTypeId !== undefined && { eventTypeId: fields.eventTypeId || null }),
          ...(fields.sourceOfInformationId !== undefined && {
            sourceOfInformationId: fields.sourceOfInformationId || null,
          }),
          ...(fields.assignedToId !== undefined && { assignedToId: fields.assignedToId || null }),
          ...(fields.statusId !== undefined && { statusId: fields.statusId }),
        },
        select: { id: true, name: true },
      }),
    ]);

    await logAudit({
      userId: session.user.profileId,
      action: "lead.updated",
      result: "success",
      entityType: "Lead",
      entityId: id,
      ipAddress: ip,
    });

    revalidateTag("leads", "max");

    return { success: true as const, data: lead };
  } catch (err) {
    console.error("[updateLead]", err);
    return { success: false as const, error: "Gagal mengupdate lead." };
  }
}

// ─── Delete Lead ──────────────────────────────────────────────────────────────

export async function deleteLead(id: string) {
  const permResult = await requirePermission({ module: "leads", action: "delete" });
  if (permResult.error) return { success: false as const, error: permResult.error };
  const session = permResult.session!;

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown";

  if (!mutationLimiter.check(`delete-lead:${session.user.id}`)) {
    return { success: false as const, ...rateLimitError() };
  }

  try {
    await db.$transaction([
      db.lead.delete({ where: { id } }),
    ]);

    await logAudit({
      userId: session.user.profileId,
      action: "lead.deleted",
      result: "success",
      entityType: "Lead",
      entityId: id,
      ipAddress: ip,
    });

    revalidateTag("leads", "max");

    return { success: true as const };
  } catch (err) {
    console.error("[deleteLead]", err);
    return { success: false as const, error: "Gagal menghapus lead." };
  }
}

// ─── Update Lead Status (Kanban drag) ────────────────────────────────────────

export async function updateLeadStatus(data: UpdateLeadStatusInput) {
  const permResult = await requirePermission({ module: "leads", action: "edit" });
  if (permResult.error) return { success: false as const, error: permResult.error };
  const session = permResult.session!;

  if (!mutationLimiter.check(`update-lead-status:${session.user.id}`)) {
    return { success: false as const, ...rateLimitError() };
  }

  const parsed = updateLeadStatusSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0].message };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown";

  try {
    await db.$transaction([
      db.lead.update({
        where: { id: parsed.data.id },
        data: { statusId: parsed.data.statusId },
      }),
    ]);

    await logAudit({
      userId: session.user.profileId,
      action: "lead.status_changed",
      result: "success",
      entityType: "Lead",
      entityId: parsed.data.id,
      ipAddress: ip,
    });

    revalidateTag("leads", "max");

    return { success: true as const };
  } catch (err) {
    console.error("[updateLeadStatus]", err);
    return { success: false as const, error: "Gagal mengupdate status lead." };
  }
}

// ─── Update Lead Assignee ────────────────────────────────────────────────────

export async function updateLeadAssignee(leadId: string, assignedToId: string | null) {
  const permResult = await requirePermission({ module: "leads", action: "edit" });
  if (permResult.error) return { success: false as const, error: permResult.error };
  const session = permResult.session!;

  if (!mutationLimiter.check(`update-lead-assignee:${session.user.id}`)) {
    return { success: false as const, ...rateLimitError() };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown";

  try {
    await db.$transaction([
      db.lead.update({
        where: { id: leadId },
        data: { assignedToId },
      }),
    ]);

    await logAudit({
      userId: session.user.profileId,
      action: "lead.assignee_changed",
      result: "success",
      entityType: "Lead",
      entityId: leadId,
      ipAddress: ip,
    });

    revalidateTag("leads", "max");

    return { success: true as const };
  } catch (err) {
    console.error("[updateLeadAssignee]", err);
    return { success: false as const, error: "Gagal mengupdate assignee lead." };
  }
}

// ─── Convert Lead to Customer ─────────────────────────────────────────────────
// Called when lead reaches Deal status and admin clicks "Convert"

export async function convertLead(leadId: string) {
  const permResult = await requirePermission({ module: "leads", action: "edit" });
  if (permResult.error) return { success: false as const, error: permResult.error };
  const session = permResult.session!;

  if (!mutationLimiter.check(`convert-lead:${session.user.id}`)) {
    return { success: false as const, ...rateLimitError() };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown";

  const lead = await db.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      name: true,
      email: true,
      contactNumbers: true,
      convertedAt: true,
      status: { select: { isFinal: true, isSystem: true, name: true } },
    },
  });

  if (!lead) return { success: false as const, error: "Lead tidak ditemukan." };
  if (lead.convertedAt) return { success: false as const, error: "Lead sudah pernah dikonversi." };
  if (!lead.status.isSystem || !lead.status.isFinal) {
    return { success: false as const, error: "Lead harus berstatus Deal untuk dikonversi." };
  }

  try {
    const mobileNumberJson = JSON.parse(JSON.stringify(lead.contactNumbers)) as Prisma.InputJsonValue;

    const customer = await db.customer.create({
      data: {
        name: lead.name,
        email: lead.email ?? "",
        mobileNumber: mobileNumberJson,
        type: "Personal",
        memberStatus: "Non-Member",
      },
      select: { id: true },
    });

    await db.$transaction([
      db.lead.update({
        where: { id: leadId },
        data: {
          convertedAt: new Date(),
          convertedToCustomerId: customer.id,
        },
      }),
    ]);

    await logAudit({
      userId: session.user.profileId,
      action: "lead.converted",
      result: "success",
      entityType: "Lead",
      entityId: leadId,
      changes: { customerId: customer.id },
      ipAddress: ip,
    });

    revalidateTag("leads", "max");
    revalidateTag("customers", "max");

    return { success: true as const, data: { customerId: customer.id } };
  } catch (err) {
    console.error("[convertLead]", err);
    return { success: false as const, error: "Gagal mengkonversi lead." };
  }
}
