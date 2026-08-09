import { requireAnyPermissionForRoute } from "@/lib/permissions";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { revalidateTag } from "next/cache";
import { updateDailyActivitySegmentSchema } from "@/lib/validations/daily-activity-segment";

// ─── PATCH /api/daily-activity-segments/[id] ─────────────────────────────────

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const { session, response } = await requireAnyPermissionForRoute([
    { module: "settings-daily-activity-segment", action: "edit" },
    { module: "daily-activity", action: "edit" },
  ]);
  if (response) return response;
  if (!mutationLimiter.check(`patch-daily-activity-segment:${session.user.id}`)) return rateLimitResponse();

  const body = await req.json() as Record<string, unknown>;
  const parsed = updateDailyActivitySegmentSchema.safeParse({ ...body, id });
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const existing = await db.dailyActivitySegment.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "Segment tidak ditemukan." }, { status: 404 });
  }

  try {
    const { id: _id, ...fields } = parsed.data;

    const [updated] = await db.$transaction([
      db.dailyActivitySegment.update({
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
      action: "daily_activity_segment.updated",
      result: "success",
      entityType: "DailyActivitySegment",
      entityId: id,
    });

    revalidateTag("daily-activity-segments", "max");

    return Response.json(updated);
  } catch {
    return Response.json({ error: "Gagal mengupdate segment." }, { status: 500 });
  }
}

// ─── DELETE /api/daily-activity-segments/[id] ────────────────────────────────

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const { session, response } = await requireAnyPermissionForRoute([
    { module: "settings-daily-activity-segment", action: "delete" },
    { module: "daily-activity", action: "delete" },
  ]);
  if (response) return response;
  if (!mutationLimiter.check(`delete-daily-activity-segment:${session.user.id}`)) return rateLimitResponse();

  const existing = await db.dailyActivitySegment.findUnique({
    where: { id },
    select: { name: true },
  });

  if (!existing) {
    return Response.json({ error: "Segment tidak ditemukan." }, { status: 404 });
  }

  try {
    await db.$transaction([
      db.dailyActivitySegment.delete({ where: { id } }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "daily_activity_segment.deleted",
      result: "success",
      entityType: "DailyActivitySegment",
      entityId: id,
    });

    revalidateTag("daily-activity-segments", "max");

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Gagal menghapus segment." }, { status: 500 });
  }
}
