import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { hasPermission } from "@/lib/permissions";
import { getEmployeeById } from "@/lib/queries/employees";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!apiLimiter.check(`employee-detail:${session.user.id}`)) return rateLimitResponse();

  const canViewAll = await hasPermission(session.user.roleId, "hr", "view-all");
  const canView = canViewAll || (await hasPermission(session.user.roleId, "hr", "view"));
  if (!canView) return Response.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    const employee = await getEmployeeById(id);
    if (!employee) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(employee);
  } catch {
    return Response.json({ error: "Failed to fetch employee" }, { status: 500 });
  }
}
