import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { requirePermissionForRoute } from "@/lib/permissions";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!apiLimiter.check(`complimentaries:${session.user.id}`)) return rateLimitResponse();

  const { response } = await requirePermissionForRoute({ module: "complimentary", action: "view" });
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const activeOnly = searchParams.get("activeOnly") !== "false";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "50", 10)));

  const where = {
    ...(activeOnly ? { isActive: true } : {}),
    ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
  };

  const [items, total] = await Promise.all([
    db.complimentary.findMany({
      where,
      select: {
        id: true,
        name: true,
        price: true,
        description: true,
        isShowPrice: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.complimentary.count({ where }),
  ]);

  return Response.json({ items, total, page, pageSize });
}
