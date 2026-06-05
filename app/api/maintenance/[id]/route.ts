import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { revalidateTag } from "next/cache";
import { getMaintenanceTicketById } from "@/lib/queries/maintenance";
import { updateMaintenanceTicketSchema } from "@/lib/validations/maintenance";

// ─── GET /api/maintenance/[id] ────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { session, response } = await requirePermissionForRoute({
    module: "maintenance",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`maintenance-detail:${session.user.id}`)) return rateLimitResponse();

  try {
    const ticket = await getMaintenanceTicketById(id);
    if (!ticket) {
      return Response.json({ error: "Tiket tidak ditemukan." }, { status: 404 });
    }
    return Response.json(ticket);
  } catch {
    return Response.json({ error: "Gagal mengambil tiket maintenance" }, { status: 500 });
  }
}

// ─── PATCH /api/maintenance/[id] ─────────────────────────────────────────────

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { session, response } = await requirePermissionForRoute({
    module: "maintenance",
    action: "edit",
  });
  if (response) return response;
  if (!mutationLimiter.check(`patch-maintenance:${session.user.id}`)) return rateLimitResponse();

  const body = await req.json() as Record<string, unknown>;
  const parsed = updateMaintenanceTicketSchema.safeParse({ ...body, id });
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const existing = await db.maintenanceTicket.findUnique({
    where: { id },
    select: { id: true, priorityId: true },
  });
  if (!existing) {
    return Response.json({ error: "Tiket tidak ditemukan." }, { status: 404 });
  }

  // Recalculate estimateDate if priorityId changed
  let estimateDate: Date | undefined;
  if (parsed.data.priorityId !== undefined && parsed.data.priorityId !== existing.priorityId) {
    const priority = await db.maintenancePriority.findUnique({
      where: { id: parsed.data.priorityId },
      select: { deadlineDays: true },
    });
    if (!priority) {
      return Response.json({ error: "Prioritas tidak ditemukan." }, { status: 400 });
    }
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + priority.deadlineDays);
    estimateDate = newDate;
  }

  try {
    const { id: _id, ...fields } = parsed.data;

    const [updated] = await db.$transaction([
      db.maintenanceTicket.update({
        where: { id },
        data: {
          ...(fields.type !== undefined && { type: fields.type }),
          ...(fields.description !== undefined && { description: fields.description }),
          ...(fields.venueId !== undefined && { venueId: fields.venueId }),
          ...(fields.categoryId !== undefined && { categoryId: fields.categoryId }),
          ...(fields.priorityId !== undefined && { priorityId: fields.priorityId }),
          ...(fields.statusId !== undefined && { statusId: fields.statusId }),
          ...(fields.assignedToId !== undefined && { assignedToId: fields.assignedToId }),
          ...(fields.isVendor !== undefined && { isVendor: fields.isVendor }),
          ...(fields.isAudit !== undefined && { isAudit: fields.isAudit }),
          ...(fields.frequency !== undefined && { frequency: fields.frequency }),
          ...(fields.nextDueDate !== undefined && {
            nextDueDate: fields.nextDueDate ? new Date(fields.nextDueDate) : null,
          }),
          ...(estimateDate !== undefined && { estimateDate }),
        },
        select: { id: true, type: true, description: true, estimateDate: true, updatedAt: true },
      }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "maintenance.updated",
      result: "success",
      entityType: "MaintenanceTicket",
      entityId: id,
    });

    revalidateTag("maintenance", "max");

    return Response.json(updated);
  } catch {
    return Response.json({ error: "Gagal mengupdate tiket maintenance." }, { status: 500 });
  }
}

// ─── DELETE /api/maintenance/[id] ────────────────────────────────────────────

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { session, response } = await requirePermissionForRoute({
    module: "maintenance",
    action: "delete",
  });
  if (response) return response;
  if (!mutationLimiter.check(`delete-maintenance:${session.user.id}`)) return rateLimitResponse();

  const existing = await db.maintenanceTicket.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return Response.json({ error: "Tiket tidak ditemukan." }, { status: 404 });
  }

  try {
    await db.$transaction([
      db.maintenanceTicket.delete({ where: { id } }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "maintenance.deleted",
      result: "success",
      entityType: "MaintenanceTicket",
      entityId: id,
    });

    revalidateTag("maintenance", "max");

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Gagal menghapus tiket maintenance." }, { status: 500 });
  }
}
