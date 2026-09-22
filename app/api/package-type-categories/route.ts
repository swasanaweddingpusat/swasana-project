import { requireAnyPermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getPackageTypeCategories } from "@/lib/queries/package-type-categories";

export async function GET() {
  // Shared reference data — readable by anyone who creates/edits packages,
  // not just settings managers (see /package-type-categories/settings for that).
  const { session, response } = await requireAnyPermissionForRoute([
    { module: "package", action: "view" },
    { module: "package-mice", action: "view" },
  ]);
  if (response) return response;
  if (!apiLimiter.check(`package-type-categories:${session.user.id}`)) return rateLimitResponse();

  try {
    const items = await getPackageTypeCategories();
    return Response.json(items);
  } catch {
    return Response.json({ error: "Failed to fetch package type categories" }, { status: 500 });
  }
}
