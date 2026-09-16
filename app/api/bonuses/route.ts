import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { requirePermissionForRoute } from "@/lib/permissions";
import { db } from "@/lib/db";

export async function GET(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({ module: "bonus", action: "view" });
  if (response) return response;

  if (!apiLimiter.check(`bonuses:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const activeOnly = searchParams.get("activeOnly") !== "false";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "50", 10)));

  const where = {
    ...(activeOnly ? { isActive: true } : {}),
    ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
  };

  const [data, total] = await Promise.all([
    db.bonus.findMany({
      where,
      select: {
        id: true,
        name: true,
        price: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.bonus.count({ where }),
  ]);

  return Response.json({ data, total, page, pageSize });
}
