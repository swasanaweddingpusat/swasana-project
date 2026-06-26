import { type NextRequest } from "next/server";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { requirePermissionForRoute } from "@/lib/permissions";
import { getEmployeeSalaries } from "@/lib/queries/employeeSalaries";

export async function GET(req: NextRequest): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "hr-payroll",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`employee-salaries-list:${session!.user.id}`)) return rateLimitResponse();

  try {
    const { searchParams } = req.nextUrl;
    const profileId = searchParams.get("profileId") ?? undefined;
    const salaryComponentId = searchParams.get("salaryComponentId") ?? undefined;

    const result = await getEmployeeSalaries({ profileId, salaryComponentId });
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch employee salaries" }, { status: 500 });
  }
}
