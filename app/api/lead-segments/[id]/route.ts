import { requirePermissionForRoute } from "@/lib/permissions";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { revalidateTag } from "next/cache";
import { updateLeadSegmentSchema } from "@/lib/validations/lead-segment";

// ─── PATCH /api/lead-segments/[id] ───────────────────────────────────────────

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const { session, response } = await requirePermissionForRoute({
    module: "settings-lead-segment",
    action: "edit",
  });
  if (response) return response;
  if (!mutationLimiter.check(`patch-lead-segment:${session.user.id}`)) return rateLimitResponse();

  const body = await req.json() as Record<string, unknown>;
  const parsed = updateLeadSegmentSchema.safeParse({ ...body, id });
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const existing = await db.leadSegment.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "Segment tidak ditemukan." }, { status: 404 });
  }

  try {
    const { id: _id, ...fields } = parsed.data;

    const [updated] = await db.$transaction([
      db.leadSegment.update({
        where: { id },
        data: {
          ...(fields.name !== undefined && { name: fields.name }),
          ...(fields.isActive !== undefined && { isActive: fields.isActive }),
          ...(fields.sortOrder !== undefined && { sortOrder: fields.sortOrder }),
        },
        select: { id: true, name: true, isActive: true, sortOrder: true },
      }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "lead_segment.updated",
      result: "success",
      entityType: "LeadSegment",
      entityId: id,
    });

    revalidateTag("lead-segments", "max");

    return Response.json(updated);
  } catch {
    return Response.json({ error: "Gagal mengupdate segment." }, { status: 500 });
  }
}

// ─── DELETE /api/lead-segments/[id] ──────────────────────────────────────────

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const { session, response } = await requirePermissionForRoute({
    module: "settings-lead-segment",
    action: "delete",
  });
  if (response) return response;
  if (!mutationLimiter.check(`delete-lead-segment:${session.user.id}`)) return rateLimitResponse();

  const existing = await db.leadSegment.findUnique({
    where: { id },
    select: { name: true },
  });

  if (!existing) {
    return Response.json({ error: "Segment tidak ditemukan." }, { status: 404 });
  }

  try {
    await db.$transaction([
      db.leadSegment.delete({ where: { id } }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "lead_segment.deleted",
      result: "success",
      entityType: "LeadSegment",
      entityId: id,
    });

    revalidateTag("lead-segments", "max");

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Gagal menghapus segment." }, { status: 500 });
  }
}
