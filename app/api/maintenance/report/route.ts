import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getMaintenanceReport } from "@/lib/queries/maintenance";

// ─── GET /api/maintenance/report ─────────────────────────────────────────────

export async function GET(req: Request) {
  const { session, response } = await requirePermissionForRoute({
    module: "maintenance",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`maintenance-report:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);

  const filter = {
    venueId: searchParams.get("venueId") ?? undefined,
    brandId: searchParams.get("brandId") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
  };

  try {
    const report = await getMaintenanceReport(filter);
    return Response.json(report);
  } catch {
    return Response.json({ error: "Gagal mengambil laporan maintenance" }, { status: 500 });
  }
}
