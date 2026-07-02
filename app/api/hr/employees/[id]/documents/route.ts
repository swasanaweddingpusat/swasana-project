import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { hasPermission } from "@/lib/permissions";
import { getEmployeeDocuments } from "@/lib/queries/employees";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!apiLimiter.check(`employee-docs:${session.user.id}`)) return rateLimitResponse();

  const canView =
    (await hasPermission(session.user.roleId, "hr", "view-all")) ||
    (await hasPermission(session.user.roleId, "hr", "view"));
  if (!canView) return Response.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    const docs = await getEmployeeDocuments(id);
    return Response.json(docs);
  } catch {
    return Response.json({ error: "Failed to fetch documents" }, { status: 500 });
  }
}
