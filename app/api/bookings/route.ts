import { getBookings } from "@/lib/queries/bookings";
import { requirePermissionForRoute } from "@/lib/permissions";

export async function GET() {
  const { response } = await requirePermissionForRoute({ module: "bookings", action: "read" });
  if (response) return response;
  const data = await getBookings();
  return Response.json(data);
}
