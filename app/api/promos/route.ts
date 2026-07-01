import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { requirePermissionForRoute } from "@/lib/permissions";
import { db } from "@/lib/db";

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!apiLimiter.check(`promos:${session.user.id}`)) return rateLimitResponse();

  const { response } = await requirePermissionForRoute({ module: "promo", action: "view" });
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get("activeOnly") !== "false";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "500", 10)));

  const where = activeOnly ? { isActive: true } : {};

  const [items, total] = await Promise.all([
    db.discountProgram.findMany({
      where,
      select: {
        id: true,
        name: true,
        isActive: true,
        discountType: true,
        discountValue: true,
        minTransaction: true,
        periodStart: true,
        periodEnd: true,
        eventEligibleStart: true,
        eventEligibleEnd: true,
        quota: true,
        usedCount: true,
        description: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.discountProgram.count({ where }),
  ]);

  return Response.json({ items, total, page, pageSize });
}
