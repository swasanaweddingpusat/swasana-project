import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { requirePermissionForRoute } from "@/lib/permissions";
import { getPayrollPeriodById } from "@/lib/queries/payrollPeriods";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "hr-payroll",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`payroll-period-detail:${session!.user.id}`)) return rateLimitResponse();

  try {
    const { id } = await params;
    const result = await getPayrollPeriodById(id);
    if (!result) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch payroll period" }, { status: 500 });
  }
}
