import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, response } = await requirePermissionForRoute({ module: "booking", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`revisions:${session.user.id}`)) return rateLimitResponse();

  try {
    const { searchParams } = new URL(_req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 10));
    const skip = (page - 1) * limit;
    const where = { bookingId: id };

    const [data, total] = await Promise.all([
      db.bookingRevision.findMany({
        where,
        orderBy: { revisionNumber: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          revisionNumber: true,
          reason: true,
          packageName: true,
          pax: true,
          price: true,
          venueName: true,
          createdAt: true,
        },
      }),
      db.bookingRevision.count({ where }),
    ]);
    return Response.json({ data, total, page, limit });
  } catch {
    return Response.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
