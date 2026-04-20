import { requirePermissionForRoute } from "@/lib/permissions";
import { getCustomers } from "@/lib/queries/customers";

export async function GET() {
  const { response } = await requirePermissionForRoute({ module: "customers", action: "read" });
  if (response) return response;

  const customers = await getCustomers();
  return Response.json(customers);
}
