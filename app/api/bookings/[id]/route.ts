import { getBookingById } from "@/lib/queries/bookings";
import { requirePermissionForRoute } from "@/lib/permissions";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requirePermissionForRoute({ module: "bookings", action: "read" });
  if (response) return response;
  const { id } = await params;
  const data = await getBookingById(id);
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(data);
}
