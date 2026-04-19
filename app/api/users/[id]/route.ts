import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getUserById } from "@/lib/queries/users";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, response } = await requirePermissionForRoute({
    module: "settings",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`user-detail:${session.user.id}`)) return rateLimitResponse();

  try {
    const { id } = await params;
    const user = await getUserById(id);

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json(user);
  } catch {
    return Response.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}
