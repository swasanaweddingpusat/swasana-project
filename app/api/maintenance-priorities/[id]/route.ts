import { requirePermissionForRoute } from "@/lib/permissions";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { revalidateTag } from "next/cache";
import { updateMaintenancePrioritySchema } from "@/lib/validations/maintenance";

// ─── PATCH /api/maintenance-priorities/[id] ──────────────────────────────────

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { session, response } = await requirePermissionForRoute({
    module: "settings-maintenance-priority",
    action: "edit",
  });
  if (response) return response;
  if (!mutationLimiter.check(`patch-maintenance-priority:${session.user.id}`)) return rateLimitResponse();

  const body = await req.json() as Record<string, unknown>;
  const parsed = updateMaintenancePrioritySchema.safeParse({ ...body, id });
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const existing = await db.maintenancePriority.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "Prioritas tidak ditemukan." }, { status: 404 });
  }

  try {
    const { id: _id, ...fields } = parsed.data;

    const [updated] = await db.$transaction([
      db.maintenancePriority.update({
        where: { id },
        data: {
          ...(fields.name !== undefined && { name: fields.name }),
          ...(fields.deadlineDays !== undefined && { deadlineDays: fields.deadlineDays }),
        },
        select: { id: true, name: true, deadlineDays: true, createdAt: true },
      }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "maintenance_priority.updated",
      result: "success",
      entityType: "MaintenancePriority",
      entityId: id,
    });

    revalidateTag("maintenance-priorities", "max");

    return Response.json(updated);
  } catch {
    return Response.json({ error: "Gagal mengupdate prioritas." }, { status: 500 });
  }
}

// ─── DELETE /api/maintenance-priorities/[id] ─────────────────────────────────

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { session, response } = await requirePermissionForRoute({
    module: "settings-maintenance-priority",
    action: "delete",
  });
  if (response) return response;
  if (!mutationLimiter.check(`delete-maintenance-priority:${session.user.id}`)) return rateLimitResponse();

  const existing = await db.maintenancePriority.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!existing) {
    return Response.json({ error: "Prioritas tidak ditemukan." }, { status: 404 });
  }

  try {
    await db.$transaction([
      db.maintenancePriority.delete({ where: { id } }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "maintenance_priority.deleted",
      result: "success",
      entityType: "MaintenancePriority",
      entityId: id,
    });

    revalidateTag("maintenance-priorities", "max");

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Gagal menghapus prioritas. Mungkin masih dipakai oleh tiket." }, { status: 500 });
  }
}
