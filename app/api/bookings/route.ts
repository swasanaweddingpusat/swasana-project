import { getBookings } from "@/lib/queries/bookings";
import { requirePermissionForRoute } from "@/lib/permissions";

export async function GET() {
  const { response } = await requirePermissionForRoute({ module: "booking", action: "view" });
  if (response) return response;
  const data = await getBookings();
  return Response.json(data);
}
