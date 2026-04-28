import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getCustomers } from "@/lib/queries/customers";

export async function GET() {
  const { session, response } = await requirePermissionForRoute({ module: "customers", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`customers-list:${session.user.id}`)) return rateLimitResponse();

  const customers = await getCustomers();
  return Response.json(customers);
}
