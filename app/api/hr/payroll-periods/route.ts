import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { requirePermissionForRoute } from "@/lib/permissions";
import { getPayrollPeriods } from "@/lib/queries/payrollPeriods";

export async function GET(): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "hr-payroll",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`payroll-periods-list:${session!.user.id}`)) return rateLimitResponse();

  try {
    const result = await getPayrollPeriods();
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch payroll periods" }, { status: 500 });
  }
}
