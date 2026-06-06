import { requirePermissionForRoute } from "@/lib/permissions";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { revalidateTag } from "next/cache";
import { updateMaintenanceStatusSchema } from "@/lib/validations/maintenance";

// ─── PATCH /api/maintenance-statuses/[id] ────────────────────────────────────

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { session, response } = await requirePermissionForRoute({
    module: "settings-maintenance-status",
    action: "edit",
  });
  if (response) return response;
  if (!mutationLimiter.check(`patch-maintenance-status:${session.user.id}`)) return rateLimitResponse();

  const body = await req.json() as Record<string, unknown>;
  const parsed = updateMaintenanceStatusSchema.safeParse({ ...body, id });
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const existing = await db.maintenanceStatus.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "Status tidak ditemukan." }, { status: 404 });
  }

  try {
    const { id: _id, ...fields } = parsed.data;

    const [updated] = await db.$transaction([
      db.maintenanceStatus.update({
        where: { id },
        data: {
          ...(fields.name !== undefined && { name: fields.name }),
          ...(fields.order !== undefined && { order: fields.order }),
        },
        select: { id: true, name: true, order: true, createdAt: true },
      }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "maintenance_status.updated",
      result: "success",
      entityType: "MaintenanceStatus",
      entityId: id,
    });

    revalidateTag("maintenance-statuses", "max");

    return Response.json(updated);
  } catch {
    return Response.json({ error: "Gagal mengupdate status." }, { status: 500 });
  }
}

// ─── DELETE /api/maintenance-statuses/[id] ───────────────────────────────────

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { session, response } = await requirePermissionForRoute({
    module: "settings-maintenance-status",
    action: "delete",
  });
  if (response) return response;
  if (!mutationLimiter.check(`delete-maintenance-status:${session.user.id}`)) return rateLimitResponse();

  const existing = await db.maintenanceStatus.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!existing) {
    return Response.json({ error: "Status tidak ditemukan." }, { status: 404 });
  }

  try {
    await db.$transaction([
      db.maintenanceStatus.delete({ where: { id } }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "maintenance_status.deleted",
      result: "success",
      entityType: "MaintenanceStatus",
      entityId: id,
    });

    revalidateTag("maintenance-statuses", "max");

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Gagal menghapus status. Mungkin masih dipakai oleh tiket." }, { status: 500 });
  }
}
