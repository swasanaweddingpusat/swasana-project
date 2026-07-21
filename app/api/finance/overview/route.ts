import { requireAnyPermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getCompanyFinanceSummary, getGroupsFinanceBreakdown } from "@/lib/queries/finance";

export async function GET(_request: Request) {
  // Overview dibagi AR & AP — cukup salah satu.
  const { session, response } = await requireAnyPermissionForRoute([
    { module: "finance-ar", action: "view" },
    { module: "finance-ap", action: "view" },
  ]);
  if (response) return response;
  if (!apiLimiter.check(`finance-overview:${session.user.id}`)) return rateLimitResponse();

  const [summary, groups] = await Promise.all([
    getCompanyFinanceSummary(),
    getGroupsFinanceBreakdown(),
  ]);

  return Response.json({ summary, groups });
}
