import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";

export async function GET() {
  const { session, response } = await requirePermissionForRoute({
    module: "settings-venues",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`venues-settings:${session.user.id}`)) return rateLimitResponse();

  try {
    const venues = await db.venue.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      include: {
        brand: { select: { id: true, name: true, code: true } },
      },
      take: 500,
    });
    return Response.json(venues);
  } catch {
    return Response.json({ error: "Failed to fetch venues" }, { status: 500 });
  }
}
