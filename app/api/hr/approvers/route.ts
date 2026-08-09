import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";

export async function GET(): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "hr-recruitment",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`hr-approvers:${session.user.id}`)) return rateLimitResponse();

  try {
    const approvers = await db.profile.findMany({
      where: { status: "active" },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
      take: 500,
    });
    return Response.json(approvers);
  } catch {
    return Response.json({ error: "Failed to fetch approvers" }, { status: 500 });
  }
}
