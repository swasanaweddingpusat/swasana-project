import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getVendorCategories } from "@/lib/queries/vendors";

export async function GET() {
  const { session, response } = await requirePermissionForRoute({
    module: "vendor",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`vendors-list:${session.user.id}`)) return rateLimitResponse();

  try {
    const result = await getVendorCategories();
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch vendors" }, { status: 500 });
  }
}
