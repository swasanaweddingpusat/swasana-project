import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getLeadStatuses } from "@/lib/queries/leads";

export async function GET(req: Request) {
  const { session, response } = await requirePermissionForRoute({
    module: "leads",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`lead-statuses:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const categoryParam = searchParams.get("category");
  const category =
    categoryParam === "WEDDINGS" || categoryParam === "MICE"
      ? categoryParam
      : undefined;

  try {
    const statuses = await getLeadStatuses(category);
    return Response.json(statuses);
  } catch {
    return Response.json({ error: "Gagal mengambil lead statuses" }, { status: 500 });
  }
}
