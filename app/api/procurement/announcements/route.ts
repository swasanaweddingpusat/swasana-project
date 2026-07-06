import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { revalidateTag } from "next/cache";
import {
  createAnnouncementSchema,
} from "@/lib/validations/procurement";
import { getAnnouncementList } from "@/lib/queries/procurement";

// ─── GET /api/procurement/announcements ──────────────────────────────────────

export async function GET(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "procurement",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`announcement-list:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));

  try {
    const result = await getAnnouncementList(page, limit);
    return Response.json(result);
  } catch {
    return Response.json({ error: "Gagal mengambil data pengumuman" }, { status: 500 });
  }
}

// ─── POST /api/procurement/announcements ─────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "procurement",
    action: "create",
  });
  if (response) return response;
  if (!mutationLimiter.check(`create-announcement:${session.user.id}`)) return rateLimitResponse();

  const body: unknown = await req.json();
  const parsed = createAnnouncementSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  try {
    const [item] = await db.$transaction([
      db.procurementAnnouncement.create({
        data: {
          title: parsed.data.title,
          content: parsed.data.content,
          isActive: parsed.data.isActive,
          targetAudience: parsed.data.targetAudience,
          targetList: parsed.data.targetList,
          createdById: session.user.profileId,
        },
        select: { id: true, title: true, isActive: true, createdAt: true },
      }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "procurement.announcement.created",
      result: "success",
      entityType: "ProcurementAnnouncement",
      entityId: item.id,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });

    revalidateTag("procurement", "max");

    return Response.json(item, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal membuat pengumuman" }, { status: 500 });
  }
}
