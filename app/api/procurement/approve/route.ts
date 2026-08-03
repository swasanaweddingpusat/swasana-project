import { requirePermissionForRoute } from "@/lib/permissions";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { revalidateTag } from "next/cache";
import { bulkApproveProcurementSchema } from "@/lib/validations/procurement";

// ─── PATCH /api/procurement/approve ────────────────────────────────────────────

export async function PATCH(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "procurement",
    action: "approve",
  });
  if (response) return response;
  if (!mutationLimiter.check(`approve-procurement:${session.user.id}`)) return rateLimitResponse();

  const body: unknown = await req.json();
  const parsed = bulkApproveProcurementSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const ids = [...new Set(parsed.data.ids)];

  const items = await db.procurementItem.findMany({
    where: { id: { in: ids } },
    select: { id: true, status: true },
  });

  if (items.length !== ids.length) {
    return Response.json({ error: "Beberapa pengajuan tidak ditemukan." }, { status: 404 });
  }

  const invalidItems = items.filter((item) => item.status !== "PENDING");
  if (invalidItems.length > 0) {
    return Response.json(
      { error: "Hanya pengajuan dengan status Menunggu yang bisa disetujui." },
      { status: 422 }
    );
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  try {
    const updates = items.map((item) =>
      db.procurementItem.update({
        where: { id: item.id },
        data: {
          status: "APPROVED",
          approvedById: session.user.profileId,
          approvedAt: new Date(),
        },
        select: { id: true, status: true, approvedAt: true },
      })
    );

    const updatedItems = await db.$transaction(updates);

    await logAudit({
      userId: session.user.id,
      action: "procurement.bulk_approve",
      result: "success",
      entityType: "ProcurementItem",
      entityId: ids.join(","),
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });

    revalidateTag("procurement", "max");
    revalidateTag("procurement-budgets", "max");

    return Response.json(updatedItems);
  } catch (err) {
    console.error("[PROCUREMENT] Failed to bulk approve items:", err);
    return Response.json({ error: "Gagal menyetujui pengajuan pengadaan." }, { status: 500 });
  }
}
