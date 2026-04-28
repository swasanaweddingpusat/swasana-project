import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getCategoryApprovals } from "@/actions/catering-approval";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requirePermissionForRoute({ module: "booking", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`catering-approval:${session.user.id}`)) return rateLimitResponse();

  const { id } = await params;
  const url = new URL(_req.url);
  const category = (url.searchParams.get("category") ?? "catering") as "catering" | "decoration";

  const approvals = await getCategoryApprovals(id, category);
  return Response.json(approvals);
}
