import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const { session, response } = await requirePermissionForRoute({ module: "settings-payment-methods", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`pm-list:${session.user.id}`)) return rateLimitResponse();

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 10));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      db.paymentMethod.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: { venue: { select: { id: true, name: true } } },
      }),
      db.paymentMethod.count(),
    ]);
    return Response.json({ data, total, page, limit });
  } catch {
    return Response.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
