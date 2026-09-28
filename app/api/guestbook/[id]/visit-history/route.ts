import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getGuestVisitHistory } from "@/lib/queries/guestbookEntries";
import type { DataScope } from "@/types/user";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "guestbook",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`guestbook-visit-history:${session.user.id}`)) return rateLimitResponse();

  const { id } = await params;
  const profileId = session.user.profileId ?? undefined;
  const dataScope: DataScope = session.user.dataScope ?? "own";

  try {
    const history = await getGuestVisitHistory(profileId, dataScope, id);
    return Response.json({ history });
  } catch (error) {
    console.error("[GET /api/guestbook/[id]/visit-history]", error);
    return Response.json({ error: "Failed to fetch visit history" }, { status: 500 });
  }
}
