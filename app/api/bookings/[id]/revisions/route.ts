import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, response } = await requirePermissionForRoute({ module: "booking", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`revisions:${session.user.id}`)) return rateLimitResponse();

  try {
    const revisions = await db.bookingRevision.findMany({
      where: { bookingId: id },
      orderBy: { revisionNumber: "desc" },
      select: {
        id: true,
        revisionNumber: true,
        reason: true,
        packageName: true,
        variantName: true,
        variantPrice: true,
        venueName: true,
        createdAt: true,
      },
    });
    return Response.json(revisions);
  } catch {
    return Response.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
