import { z } from "zod";
import { getSalesBookings } from "@/lib/queries/groups";
import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";

const querySchema = z.object({
  salesId: z.string().min(1),
  take: z.coerce.number().int().min(1).max(500).default(100),
  skip: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({ module: "booking", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`sales-bookings:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return Response.json({ error: "Invalid query params" }, { status: 400 });
  }

  const { salesId, take, skip } = parsed.data;
  const bookings = await getSalesBookings(salesId, take, skip);
  return Response.json(bookings);
}
