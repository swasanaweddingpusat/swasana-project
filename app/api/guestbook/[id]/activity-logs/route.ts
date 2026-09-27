import { NextResponse } from "next/server";
import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requirePermissionForRoute({ module: "guestbook", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`guestbook-activity-logs:${session.user.id}`)) return rateLimitResponse();

  const { id } = await params;
  const { searchParams } = new URL(_req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 10));
  const skip = (page - 1) * limit;

  const where = { entityType: "GuestbookEntry" as const, entityId: id };

  const [logs, total] = await Promise.all([
    db.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        userId: true,
        action: true,
        result: true,
        entityType: true,
        entityId: true,
        changes: true,
        description: true,
        createdAt: true,
        profile: { select: { fullName: true, role: { select: { name: true } } } },
      },
    }),
    db.activityLog.count({ where }),
  ]);

  return NextResponse.json({ data: logs, total, page, limit });
}
