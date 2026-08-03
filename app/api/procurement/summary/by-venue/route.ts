import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getProcurementSummaryByVenue } from "@/lib/queries/procurement";

export async function GET(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "procurement",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`procurement-summary-venue:${session.user.id}`))
    return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? undefined;

  try {
    const result = await getProcurementSummaryByVenue(period);
    return Response.json(result);
  } catch (err) {
    console.error("[PROCUREMENT] Failed to get summary by venue:", err);
    return Response.json(
      { error: "Gagal mengambil ringkasan per venue" },
      { status: 500 }
    );
  }
}
