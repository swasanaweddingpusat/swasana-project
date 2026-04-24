import { getBookingById } from "@/lib/queries/bookings";
import { requirePermissionForRoute } from "@/lib/permissions";
import { getPublicUrl } from "@/lib/r2";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requirePermissionForRoute({ module: "booking", action: "view" });
  if (response) return response;
  const { id } = await params;
  const data = await getBookingById(id);
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });

  const resolved = {
    ...data,
    bookingDocuments: data.bookingDocuments.map((doc) => ({
      ...doc,
      fileUrl: getPublicUrl(doc.filePath),
    })),
  };

  return new Response(JSON.stringify(resolved, (_k, v) => (typeof v === "bigint" ? Number(v) : v)), {
    headers: { "content-type": "application/json" },
  });
}
