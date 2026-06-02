import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";

export async function GET() {
  const { session, response } = await requirePermissionForRoute({
    module: "settings-education-level",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`education-levels:${session.user.id}`)) return rateLimitResponse();

  try {
    const items = await db.educationLevel.findMany({
      select: { id: true, name: true, order: true, createdAt: true },
      orderBy: { order: "asc" },
      take: 500,
    });
    return Response.json(items);
  } catch {
    return Response.json({ error: "Failed to fetch education levels" }, { status: 500 });
  }
}
