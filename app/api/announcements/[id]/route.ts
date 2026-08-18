import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getAnnouncementById } from "@/lib/queries/announcements";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "announcement",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`announcement-detail:${session.user.id}`)) return rateLimitResponse();

  try {
    const { id } = await params;
    const announcement = await getAnnouncementById(id);
    if (!announcement)
      return Response.json({ error: "Pengumuman tidak ditemukan." }, { status: 404 });

    return Response.json(announcement);
  } catch (error) {
    console.error("[GET /api/announcements/[id]]", error);
    return Response.json({ error: "Failed to fetch announcement" }, { status: 500 });
  }
}
