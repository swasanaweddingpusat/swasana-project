import { requirePermissionForRoute } from "@/lib/permissions";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { revalidateTag } from "next/cache";
import { updateMaintenanceCategorySchema } from "@/lib/validations/maintenance";

// ─── PATCH /api/maintenance-categories/[id] ──────────────────────────────────

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { session, response } = await requirePermissionForRoute({
    module: "settings-maintenance-category",
    action: "edit",
  });
  if (response) return response;
  if (!mutationLimiter.check(`patch-maintenance-category:${session.user.id}`)) return rateLimitResponse();

  const body = await req.json() as Record<string, unknown>;
  const parsed = updateMaintenanceCategorySchema.safeParse({ ...body, id });
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const existing = await db.maintenanceCategory.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "Kategori tidak ditemukan." }, { status: 404 });
  }

  try {
    const [updated] = await db.$transaction([
      db.maintenanceCategory.update({
        where: { id },
        data: { name: parsed.data.name },
        select: { id: true, name: true, createdAt: true },
      }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "maintenance_category.updated",
      result: "success",
      entityType: "MaintenanceCategory",
      entityId: id,
    });

    revalidateTag("maintenance-categories", "max");

    return Response.json(updated);
  } catch {
    return Response.json({ error: "Gagal mengupdate kategori." }, { status: 500 });
  }
}

// ─── DELETE /api/maintenance-categories/[id] ─────────────────────────────────

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { session, response } = await requirePermissionForRoute({
    module: "settings-maintenance-category",
    action: "delete",
  });
  if (response) return response;
  if (!mutationLimiter.check(`delete-maintenance-category:${session.user.id}`)) return rateLimitResponse();

  const existing = await db.maintenanceCategory.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!existing) {
    return Response.json({ error: "Kategori tidak ditemukan." }, { status: 404 });
  }

  try {
    await db.$transaction([
      db.maintenanceCategory.delete({ where: { id } }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "maintenance_category.deleted",
      result: "success",
      entityType: "MaintenanceCategory",
      entityId: id,
    });

    revalidateTag("maintenance-categories", "max");

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Gagal menghapus kategori. Mungkin masih dipakai oleh tiket." }, { status: 500 });
  }
}
