import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getCustomers } from "@/lib/queries/customers";

export async function GET(req: Request) {
  const { session, response } = await requirePermissionForRoute({ module: "booking", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`customers-list:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const customers = await getCustomers(1, 10, search);
  return Response.json(customers);
}
