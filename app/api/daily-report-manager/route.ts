import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import {
  getDailyReports,
  getDailyReportMetrics,
  getMemberCompletionStatus,
} from "@/lib/queries/dailyReportManager";

export async function GET(request: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "daily-report-manager",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`daily-report:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId")?.trim() ?? "";
  const action = searchParams.get("action")?.trim() ?? "list";
  const rawDate = searchParams.get("date")?.trim();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  if (!groupId) {
    return Response.json({ error: "groupId is required" }, { status: 400 });
  }

  const date = rawDate ? new Date(rawDate) : new Date();

  try {
    if (action === "metrics") {
      const metrics = await getDailyReportMetrics(groupId, date);
      return Response.json(metrics);
    }

    if (action === "completion") {
      const completion = await getMemberCompletionStatus(groupId, date);
      return Response.json(completion);
    }

    // Default: paginated list
    const result = await getDailyReports(groupId, page);
    return Response.json(result);
  } catch (error) {
    console.error("[GET /api/daily-report-manager]", error);
    return Response.json({ error: "Failed to fetch daily report data" }, { status: 500 });
  }
}
