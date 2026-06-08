import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";

// GET /api/quotation-templates/[venueId]
// Returns the template (items + default paymentMethodId) for a venue, used to
// auto-fill the quotation form. Returns empty defaults when no template exists.
// Settings page also calls this to prefill the edit form.
export async function GET(_req: Request, { params }: { params: Promise<{ venueId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!apiLimiter.check(`qt-tpl-venue:${session.user.id}`)) return rateLimitResponse();

  const { venueId } = await params;

  try {
    const tpl = await db.quotationTemplate.findUnique({
      where: { venueId },
      select: {
        paymentMethodId: true,
        items: {
          orderBy: { sortOrder: "asc" },
          select: { title: true, description: true, qty: true, price: true, total: true, manualTotal: true, sortOrder: true },
        },
      },
    });

    if (!tpl) return Response.json({ items: [], paymentMethodId: null });

    return Response.json({ items: tpl.items, paymentMethodId: tpl.paymentMethodId });
  } catch {
    return Response.json({ error: "Gagal mengambil template" }, { status: 500 });
  }
}
