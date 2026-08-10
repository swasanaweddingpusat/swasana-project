import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { revalidateTag } from "next/cache";
import { updateLeadStatusSchema2 } from "@/lib/validations/daily-activity";

// ─── PATCH /api/lead-statuses/[id] ───────────────────────────────────────────

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { session, response } = await requirePermissionForRoute({
    module: "settings-lead-status",
    action: "edit",
  });
  if (response) return response;
  if (!mutationLimiter.check(`patch-lead-status:${session.user.id}`)) return rateLimitResponse();

  const body = await req.json() as Record<string, unknown>;
  const parsed = updateLeadStatusSchema2.safeParse({ ...body, id });
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // Check existence and guard system status from rename
  const existing = await db.leadStatus.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "Status tidak ditemukan." }, { status: 404 });
  }

  if (existing.isSystem && parsed.data.name !== undefined && parsed.data.name !== existing.name) {
    return Response.json({ error: "Status sistem tidak dapat diubah namanya." }, { status: 403 });
  }

  try {
    const { id: _id, ...fields } = parsed.data;

    const updated = await db.$transaction([
      db.leadStatus.update({
        where: { id },
        data: {
          ...(fields.name !== undefined && { name: fields.name }),
          ...(fields.color !== undefined && { color: fields.color }),
          ...(fields.sortOrder !== undefined && { sortOrder: fields.sortOrder }),
          ...(fields.isDefault !== undefined && { isDefault: fields.isDefault }),
          ...(fields.isFinal !== undefined && { isFinal: fields.isFinal }),
        },
        select: { id: true, name: true },
      }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "lead_status.updated",
      result: "success",
      entityType: "LeadStatus",
      entityId: id,
    });

    revalidateTag("lead-statuses", "max");

    return Response.json(updated[0]);
  } catch {
    return Response.json({ error: "Gagal mengupdate status." }, { status: 500 });
  }
}

// ─── DELETE /api/lead-statuses/[id] ──────────────────────────────────────────

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { session, response } = await requirePermissionForRoute({
    module: "settings-lead-status",
    action: "delete",
  });
  if (response) return response;
  if (!mutationLimiter.check(`delete-lead-status:${session.user.id}`)) return rateLimitResponse();
  if (!apiLimiter.check(`lead-status-delete:${session.user.id}`)) return rateLimitResponse();

  const existing = await db.leadStatus.findUnique({
    where: { id },
    select: { isSystem: true, name: true },
  });

  if (!existing) {
    return Response.json({ error: "Status tidak ditemukan." }, { status: 404 });
  }

  if (existing.isSystem) {
    return Response.json({ error: "Status sistem tidak dapat dihapus." }, { status: 403 });
  }

  try {
    await db.$transaction([
      db.leadStatus.delete({ where: { id } }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "lead_status.deleted",
      result: "success",
      entityType: "LeadStatus",
      entityId: id,
    });

    revalidateTag("lead-statuses", "max");

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Gagal menghapus status. Mungkin masih dipakai oleh lead." }, { status: 500 });
  }
}
