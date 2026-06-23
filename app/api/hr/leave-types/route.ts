import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { hasPermission } from "@/lib/permissions";
import { getLeaveTypes, getAllLeaveTypes } from "@/lib/queries/leaveTypes";

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!apiLimiter.check(`leave-types-list:${session.user.id}`)) return rateLimitResponse();

  try {
    const canViewAll = await hasPermission(session.user.roleId, "hr-leave", "view");
    const result = canViewAll ? await getAllLeaveTypes() : await getLeaveTypes();
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch leave types" }, { status: 500 });
  }
}
