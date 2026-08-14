import { requirePermissionForRoute } from "@/lib/permissions";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { revalidateTag } from "next/cache";
import { updateAnnouncementSchema } from "@/lib/validations/procurement";

// ─── PATCH /api/procurement/announcements/[id] ────────────────────────────────

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  const { session, response } = await requirePermissionForRoute({
    module: "procurement-announcement",
    action: "edit",
  });
  if (response) return response;
  if (!mutationLimiter.check(`patch-announcement:${session.user.id}`)) return rateLimitResponse();

  const existing = await db.procurementAnnouncement.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return Response.json({ error: "Pengumuman tidak ditemukan." }, { status: 404 });
  }

  const body: unknown = await req.json();
  const parsed = updateAnnouncementSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  try {
    const [updated] = await db.$transaction([
      db.procurementAnnouncement.update({
        where: { id },
        data: {
          ...(parsed.data.title !== undefined && { title: parsed.data.title }),
          ...(parsed.data.content !== undefined && { content: parsed.data.content }),
          ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
          ...(parsed.data.targetAudience !== undefined && {
            targetAudience: parsed.data.targetAudience,
          }),
          ...(parsed.data.targetList !== undefined && { targetList: parsed.data.targetList }),
        },
        select: { id: true, title: true, isActive: true, updatedAt: true },
      }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "procurement.announcement.updated",
      result: "success",
      entityType: "ProcurementAnnouncement",
      entityId: id,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });

    revalidateTag("procurement", "max");

    return Response.json(updated);
  } catch (err) {
    console.error("[PROCUREMENT] Failed to update announcement:", err);
    return Response.json({ error: "Gagal mengupdate pengumuman." }, { status: 500 });
  }
}

// ─── DELETE /api/procurement/announcements/[id] ───────────────────────────────

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  const { session, response } = await requirePermissionForRoute({
    module: "procurement-announcement",
    action: "delete",
  });
  if (response) return response;
  if (!mutationLimiter.check(`delete-announcement:${session.user.id}`)) return rateLimitResponse();

  const existing = await db.procurementAnnouncement.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return Response.json({ error: "Pengumuman tidak ditemukan." }, { status: 404 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  try {
    await db.$transaction([db.procurementAnnouncement.delete({ where: { id } })]);

    await logAudit({
      userId: session.user.id,
      action: "procurement.announcement.deleted",
      result: "success",
      entityType: "ProcurementAnnouncement",
      entityId: id,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });

    revalidateTag("procurement", "max");

    return Response.json({ success: true });
  } catch (err) {
    console.error("[PROCUREMENT] Failed to delete announcement:", err);
    return Response.json({ error: "Gagal menghapus pengumuman." }, { status: 500 });
  }
}
