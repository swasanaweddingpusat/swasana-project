import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { hasPermission } from "@/lib/permissions";
import { getPayslipById } from "@/lib/queries/payslips";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!apiLimiter.check(`payslip-detail:${session.user.id}`)) return rateLimitResponse();

  try {
    const { id } = await params;
    const payslip = await getPayslipById(id);
    if (!payslip) return Response.json({ error: "Not found" }, { status: 404 });

    const isOwner = payslip.profileId === session.user.profileId;
    const canViewAll = await hasPermission(session.user.roleId, "hr-payroll", "view");

    if (!isOwner && !canViewAll) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    return Response.json(payslip);
  } catch {
    return Response.json({ error: "Failed to fetch payslip" }, { status: 500 });
  }
}
