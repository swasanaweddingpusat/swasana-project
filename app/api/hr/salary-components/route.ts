import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { requirePermissionForRoute } from "@/lib/permissions";
import { getAllSalaryComponents } from "@/lib/queries/salaryComponents";

export async function GET(): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "hr-payroll",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`salary-components-list:${session!.user.id}`)) return rateLimitResponse();

  try {
    const result = await getAllSalaryComponents();
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch salary components" }, { status: 500 });
  }
}
