import { getBookings } from "@/lib/queries/bookings";
import { requirePermissionForRoute } from "@/lib/permissions";

export async function GET() {
  const { response } = await requirePermissionForRoute({ module: "booking", action: "view" });
  if (response) return response;
  const data = await getBookings();
  return new Response(JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? Number(v) : v)), {
    headers: { "content-type": "application/json" },
  });
}
