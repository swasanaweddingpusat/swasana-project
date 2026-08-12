import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getGuestbookEntries } from "@/lib/queries/guestbookEntries";

export async function GET(): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "guestbook",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`guestbook-list:${session.user.id}`)) return rateLimitResponse();

  try {
    const result = await getGuestbookEntries();
    return Response.json(result);
  } catch (error) {
    console.error("[GET /api/guestbook]", error);
    return Response.json({ error: "Failed to fetch guestbook entries" }, { status: 500 });
  }
}
