import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getPackages, getPackagesForBooking } from "@/lib/queries/packages";
import { z } from "zod";

const packagesQuerySchema = z.object({
  venueId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  forBooking: z.enum(["true", "false"]).optional(),
});

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const rawParams = Object.fromEntries(searchParams.entries());

  const parsed = packagesQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return Response.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const { venueId, page, pageSize, search, forBooking } = parsed.data;
  const isForBooking = forBooking === "true";

  let userId: string;
  if (isForBooking) {
    const { auth } = await import("@/lib/auth");
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
    userId = session.user.id;
  } else {
    const { session, response } = await requirePermissionForRoute({ module: "package", action: "view" });
    if (response) return response;
    userId = session.user.id;
  }

  if (!apiLimiter.check(`packages-list:${userId}`)) return rateLimitResponse();

  try {
    if (isForBooking) {
      const result = await getPackagesForBooking(venueId);
      return Response.json(result);
    }
    const result = await getPackages({ venueId, page, limit: pageSize, search: search ?? undefined });
    return Response.json(result);
  } catch (error) {
    console.error("[GET /api/packages]", error);
    return Response.json({ error: "Failed to fetch packages" }, { status: 500 });
  }
}
