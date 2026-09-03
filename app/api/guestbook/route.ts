import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getGuestbookEntries } from "@/lib/queries/guestbookEntries";
import type { DataScope } from "@/types/user";

export async function GET(request: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "guestbook",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`guestbook-list:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || 50));

  const profileId = session.user.profileId ?? undefined;
  // dataScope is already carried on the JWT/session (refreshed from DB every 10
  // min in lib/auth.ts), so read it straight from the session instead of an extra
  // per-request DB round-trip. Falls back to "own" defensively.
  const dataScope: DataScope = session.user.dataScope ?? "own";

  try {
    const result = await getGuestbookEntries(profileId, dataScope, { page, pageSize });
    return Response.json(result);
  } catch (error) {
    console.error("[GET /api/guestbook]", error);
    return Response.json({ error: "Failed to fetch guestbook entries" }, { status: 500 });
  }
}
