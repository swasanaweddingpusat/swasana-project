import { getBookingById } from "@/lib/queries/bookings";
import { requirePermissionForRoute } from "@/lib/permissions";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requirePermissionForRoute({ module: "booking", action: "view" });
  if (response) return response;
  const { id } = await params;
  const data = await getBookingById(id);
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? Number(v) : v)), {
    headers: { "content-type": "application/json" },
  });
}
