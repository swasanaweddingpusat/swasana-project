import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { hasPermission } from "@/lib/permissions";
import { getEmployees } from "@/lib/queries/employees";
import { employeeListQuerySchema } from "@/lib/validations/employee";

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!apiLimiter.check(`employees-list:${session.user.id}`)) return rateLimitResponse();

  const canViewAll = await hasPermission(session.user.roleId, "hr", "view-all");
  const canView = canViewAll || (await hasPermission(session.user.roleId, "hr", "view"));
  if (!canView) return Response.json({ error: "Forbidden" }, { status: 403 });

  try {
    const url = new URL(req.url);
    const params = employeeListQuerySchema.parse({
      page: url.searchParams.get("page") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      departmentId: url.searchParams.get("departmentId") ?? undefined,
      positionId: url.searchParams.get("positionId") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      employmentType: url.searchParams.get("employmentType") ?? undefined,
    });

    const result = await getEmployees(params);
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch employees" }, { status: 500 });
  }
}
