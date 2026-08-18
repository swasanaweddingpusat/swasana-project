import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getMemos } from "@/lib/queries/memos";

export async function GET(): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "internal-faq",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`memos-list:${session.user.id}`)) return rateLimitResponse();

  try {
    const result = await getMemos();
    return Response.json(result);
  } catch (error) {
    console.error("[GET /api/memos]", error);
    return Response.json({ error: "Failed to fetch memos" }, { status: 500 });
  }
}
