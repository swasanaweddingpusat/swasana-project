import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getMyPayslips } from "@/lib/queries/payslips";

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!apiLimiter.check(`my-payslips:${session.user.id}`)) return rateLimitResponse();

  try {
    const result = await getMyPayslips(session.user.profileId);
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch payslips" }, { status: 500 });
  }
}
