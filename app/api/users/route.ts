import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getUsers } from "@/lib/queries/users";
import type { UserFilters } from "@/types/user";

export async function GET(request: Request) {
  const { session, response } = await requirePermissionForRoute({
    module: "settings",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`users-list:${session.user.id}`)) return rateLimitResponse();

  try {
    const { searchParams } = new URL(request.url);

    const filters: UserFilters = {
      search: searchParams.get("search") ?? undefined,
      roleId: searchParams.get("roleId") ?? undefined,
      status: (searchParams.get("status") as UserFilters["status"]) ?? undefined,
      venueId: searchParams.get("venueId") ?? undefined,
      dataScope: (searchParams.get("dataScope") as UserFilters["dataScope"]) ?? undefined,
      page: searchParams.has("page") ? Number(searchParams.get("page")) : 1,
      limit: searchParams.has("limit") ? Number(searchParams.get("limit")) : 20,
    };

    const result = await getUsers(filters);
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
