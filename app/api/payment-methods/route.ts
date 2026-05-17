import { requirePermissionForRoute } from "@/lib/permissions";
import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const venueId = searchParams.get("venueId") ?? undefined;

  let userId: string;

  if (venueId) {
    // Booking context — cukup authenticated
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
    userId = session.user.id;
  } else {
    // Settings context — butuh permission
    const { session, response } = await requirePermissionForRoute({ module: "settings-payment-methods", action: "view" });
    if (response) return response;
    userId = session.user.id;
  }

  if (!apiLimiter.check(`pm-list:${userId}`)) return rateLimitResponse();

  try {
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 10));
    const skip = (page - 1) * limit;

    const where = venueId ? { venueId } : {};

    const [data, total] = await Promise.all([
      db.paymentMethod.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: { venue: { select: { id: true, name: true } } },
      }),
      db.paymentMethod.count({ where }),
    ]);
    return Response.json({ data, total, page, limit });
  } catch {
    return Response.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
