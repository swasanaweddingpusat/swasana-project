import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";

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
  if (!apiLimiter.check(`maintenance-activity:${session.user.id}`)) return rateLimitResponse();

  try {
    const logs = await db.activityLog.findMany({
      where: { entityType: "MaintenanceTicket", entityId: id },
      select: {
        id: true,
        action: true,
        result: true,
        description: true,
        createdAt: true,
        profile: { select: { fullName: true, nickName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return Response.json(
      logs.map((log) => ({
        id: log.id,
        action: log.action,
        result: log.result,
        description: log.description,
        createdAt: log.createdAt,
        user: log.profile,
      }))
    );
  } catch {
    return Response.json({ error: "Gagal mengambil aktivitas" }, { status: 500 });
  }
}
