import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { requirePermissionForRoute } from "@/lib/permissions";
import { getPayrollSettings } from "@/lib/queries/payrollSettings";

export async function GET(): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "hr-payroll",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`payroll-settings:${session!.user.id}`)) return rateLimitResponse();

  try {
    const result = await getPayrollSettings();
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch payroll settings" }, { status: 500 });
  }
}
