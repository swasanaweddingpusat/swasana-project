import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";

export async function GET() {
  const { session, response } = await requirePermissionForRoute({ module: "payment_methods", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`pm-list:${session.user.id}`)) return rateLimitResponse();

  try {
    const result = await db.paymentMethod.findMany({
      orderBy: { createdAt: "desc" },
      include: { venue: { select: { id: true, name: true } } },
    });
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
