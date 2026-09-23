import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getPackages, getPackagesForBooking, getMicePackagesForQuotation } from "@/lib/queries/packages";
import { z } from "zod";

const packagesQuerySchema = z.object({
  venueId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  forBooking: z.enum(["true", "false"]).optional(),
  forQuotation: z.enum(["true", "false"]).optional(),
  category: z.enum(["WEDDINGS", "MICE"]).optional(),
});

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const rawParams = Object.fromEntries(searchParams.entries());

  const parsed = packagesQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return Response.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const { venueId, page, pageSize, search, forBooking, forQuotation, category } = parsed.data;
  const isForBooking = forBooking === "true";
  const isForQuotation = forQuotation === "true";

  let userId: string;
  if (isForBooking || isForQuotation) {
    // Session-only auth: the quotation drawer is used by sales-mice, who do not
    // hold package-mice:view — gating on that permission would hide packages they
    // legitimately need to build a quotation.
    const { auth } = await import("@/lib/auth");
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
    userId = session.user.id;
  } else {
    const listModule = category === "MICE" ? "package-mice" : "package";
    const { session, response } = await requirePermissionForRoute({ module: listModule, action: "view" });
    if (response) return response;
    userId = session.user.id;
  }

  if (!apiLimiter.check(`packages-list:${userId}`)) return rateLimitResponse();

  try {
    if (isForQuotation) {
      const result = await getMicePackagesForQuotation(venueId);
      return Response.json(result);
    }
    if (isForBooking) {
      const result = await getPackagesForBooking(venueId, category ?? "WEDDINGS");
      return Response.json(result);
    }
    const result = await getPackages({ venueId, page, limit: pageSize, search: search ?? undefined, category: category ?? "WEDDINGS" });
    return Response.json(result);
  } catch (error) {
    console.error("[GET /api/packages]", error);
    return Response.json({ error: "Failed to fetch packages" }, { status: 500 });
  }
}
