import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getPackageTypeCategories } from "@/lib/queries/package-type-categories";

export async function GET() {
  const { session, response } = await requirePermissionForRoute({
    module: "settings-package-category",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`package-type-categories-settings:${session.user.id}`)) return rateLimitResponse();

  try {
    const items = await getPackageTypeCategories();
    return Response.json(items);
  } catch {
    return Response.json({ error: "Failed to fetch package type categories" }, { status: 500 });
  }
}
