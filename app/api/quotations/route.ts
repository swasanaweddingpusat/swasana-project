import { getQuotations } from "@/lib/queries/quotations";
import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import type { QuotationStatus, EventCategory } from "@prisma/client";

export async function GET(request: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "quotations",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`quotations:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || 10));
  const search = searchParams.get("search") ?? "";
  const status = (searchParams.get("status") ?? "") as QuotationStatus | "";
  const category = (searchParams.get("category") ?? "") as EventCategory | "";

  const result = await getQuotations({ page, pageSize, search, status, category });

  return Response.json(result);
}
