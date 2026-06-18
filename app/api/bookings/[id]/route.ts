import { getBookingById } from "@/lib/queries/bookings";
import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getPublicUrl } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requirePermissionForRoute({ module: "booking", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`booking-detail:${session.user.id}`)) return rateLimitResponse();
  const { id } = await params;
  const data = await getBookingById(id);
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });

  const resolved = {
    ...data,
    bookingDocuments: data.bookingDocuments.map((doc) => ({
      ...doc,
      fileUrl: getPublicUrl(doc.filePath),
    })),
    termOfPayments: data.termOfPayments.map((t) => ({
      ...t,
      paymentEvidence: t.paymentEvidence ? getPublicUrl(t.paymentEvidence) : null,
      partialPayments: "partialPayments" in t && Array.isArray(t.partialPayments)
        ? t.partialPayments.map((p: { evidence?: string | null;[key: string]: unknown }) => ({
            ...p,
            evidence: p.evidence ? getPublicUrl(p.evidence) : null,
          }))
        : [],
    })),
  };

  return new Response(JSON.stringify(resolved, (_k, v) => (typeof v === "bigint" ? Number(v) : v)), {
    headers: { "content-type": "application/json" },
  });
}
