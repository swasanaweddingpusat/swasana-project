import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getMemoById } from "@/lib/queries/memos";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "internal-faq",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`memo-detail:${session.user.id}`)) return rateLimitResponse();

  try {
    const { id } = await params;
    const memo = await getMemoById(id);
    if (!memo) return Response.json({ error: "Memo tidak ditemukan." }, { status: 404 });

    return Response.json(memo);
  } catch (error) {
    console.error("[GET /api/memos/[id]]", error);
    return Response.json({ error: "Failed to fetch memo" }, { status: 500 });
  }
}
