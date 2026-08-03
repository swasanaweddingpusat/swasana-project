import { requirePermissionForRoute } from "@/lib/permissions";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { revalidateTag } from "next/cache";
import { approveProcurementSchema } from "@/lib/validations/procurement";

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["APPROVED", "REJECTED"],
  APPROVED: ["COMPLETED"],
};

// ─── PATCH /api/procurement/[id]/approve ──────────────────────────────────────

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  const { session, response } = await requirePermissionForRoute({
    module: "procurement",
    action: "approve",
  });
  if (response) return response;
  if (!mutationLimiter.check(`approve-procurement:${session.user.id}`)) return rateLimitResponse();

  const item = await db.procurementItem.findUnique({
    where: { id },
    select: { id: true, status: true, keterangan: true },
  });
  if (!item) {
    return Response.json({ error: "Data pengadaan tidak ditemukan." }, { status: 404 });
  }

  const body: unknown = await req.json();
  const parsed = approveProcurementSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const targetStatus =
    parsed.data.action === "APPROVE"
      ? "APPROVED"
      : parsed.data.action === "REJECT"
        ? "REJECTED"
        : "COMPLETED";

  const allowedNext = VALID_TRANSITIONS[item.status] ?? [];
  if (!allowedNext.includes(targetStatus)) {
    return Response.json(
      { error: `Tidak bisa mengubah status dari ${item.status} ke ${targetStatus}` },
      { status: 422 }
    );
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  try {
    const [updated] = await db.$transaction([
      db.procurementItem.update({
        where: { id },
        data: {
          status: targetStatus as "APPROVED" | "REJECTED" | "COMPLETED",
          keterangan: parsed.data.keterangan ?? item.keterangan,
          approvedById: session.user.profileId,
          approvedAt: new Date(),
        },
        select: { id: true, status: true, keterangan: true, approvedAt: true },
      }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: `procurement.${parsed.data.action.toLowerCase()}`,
      result: "success",
      entityType: "ProcurementItem",
      entityId: id,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });

    revalidateTag("procurement", "max");
    revalidateTag("procurement-budgets", "max");

    return Response.json(updated);
  } catch (err) {
    console.error("[PROCUREMENT] Failed to approve item:", err);
    return Response.json({ error: "Gagal memproses persetujuan pengadaan." }, { status: 500 });
  }
}
