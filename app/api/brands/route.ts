import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";

export async function GET() {
  const { session, response } = await requirePermissionForRoute({
    module: "settings-brands",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`brands:${session.user.id}`)) return rateLimitResponse();

  try {
    const brands = await db.brand.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        venues: {
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true, code: true },
        },
      },
      take: 500,
    });
    return Response.json(brands);
  } catch {
    return Response.json({ error: "Failed to fetch brands" }, { status: 500 });
  }
}
