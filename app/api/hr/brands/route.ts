import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";

export async function GET(): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "hr-recruitment",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`hr-brands:${session.user.id}`)) return rateLimitResponse();

  try {
    const brands = await db.brand.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
      take: 200,
    });
    return Response.json(brands);
  } catch {
    return Response.json({ error: "Failed to fetch brands" }, { status: 500 });
  }
}
