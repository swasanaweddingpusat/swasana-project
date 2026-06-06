import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";

// GET /api/quotation-templates — list all templates (settings page).
export async function GET() {
  const { session, response } = await requirePermissionForRoute({
    module: "settings-quotation-templates",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`qt-tpl-list:${session.user.id}`)) return rateLimitResponse();

  try {
    const data = await db.quotationTemplate.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        venueId: true,
        paymentMethodId: true,
        updatedAt: true,
        venue: { select: { id: true, name: true } },
        paymentMethod: { select: { id: true, bankName: true, bankRecipient: true } },
        _count: { select: { items: true } },
      },
    });
    return Response.json({ data });
  } catch {
    return Response.json({ error: "Gagal mengambil template" }, { status: 500 });
  }
}
