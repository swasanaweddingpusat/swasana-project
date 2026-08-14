import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getProcurementSummary } from "@/lib/queries/procurement";

// ─── GET /api/procurement/summary ─────────────────────────────────────────────

export async function GET(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "procurement-summary",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`procurement-summary:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const venueId = searchParams.get("venueId") ?? undefined;

  try {
    const summary = await getProcurementSummary(venueId);
    return Response.json(summary);
  } catch (err) {
    console.error("[PROCUREMENT] Failed to get summary:", err);
    return Response.json({ error: "Gagal mengambil ringkasan pengadaan" }, { status: 500 });
  }
}
