import { requirePermissionForRoute } from "@/lib/permissions";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { revalidateTag } from "next/cache";
import { updateVenueBudgetSchema } from "@/lib/validations/procurement";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  const { session, response } = await requirePermissionForRoute({
    module: "procurement",
    action: "edit",
  });
  if (response) return response;
  if (!mutationLimiter.check(`patch-venue-budget:${session.user.id}`))
    return rateLimitResponse();

  const existing = await db.procurementVenueBudget.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return Response.json(
      { error: "Data saldo venue tidak ditemukan." },
      { status: 404 }
    );
  }

  const body: unknown = await req.json();
  const parsed = updateVenueBudgetSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  try {
    const [updated] = await db.$transaction([
      db.procurementVenueBudget.update({
        where: { id },
        data: {
          ...(parsed.data.venueId !== undefined && {
            venueId: parsed.data.venueId,
          }),
          ...(parsed.data.budgetAmount !== undefined && {
            budgetAmount: parsed.data.budgetAmount,
          }),
          ...(parsed.data.period !== undefined && {
            period: parsed.data.period,
          }),
          ...(parsed.data.note !== undefined && { note: parsed.data.note }),
          updatedById: session.user.profileId,
        },
        select: { id: true, budgetAmount: true, period: true, updatedAt: true },
      }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "procurement.venue_budget.updated",
      result: "success",
      entityType: "ProcurementVenueBudget",
      entityId: id,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });

    revalidateTag("procurement-budgets", "max");
    revalidateTag("procurement", "max");

    return Response.json(updated);
  } catch (err) {
    console.error("[PROCUREMENT] Failed to update venue budget:", err);
    return Response.json(
      { error: "Gagal mengupdate saldo venue." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  const { session, response } = await requirePermissionForRoute({
    module: "procurement",
    action: "delete",
  });
  if (response) return response;
  if (!mutationLimiter.check(`delete-venue-budget:${session.user.id}`))
    return rateLimitResponse();

  const existing = await db.procurementVenueBudget.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return Response.json(
      { error: "Data saldo venue tidak ditemukan." },
      { status: 404 }
    );
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  try {
    await db.$transaction([
      db.procurementVenueBudget.delete({ where: { id } }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "procurement.venue_budget.deleted",
      result: "success",
      entityType: "ProcurementVenueBudget",
      entityId: id,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });

    revalidateTag("procurement-budgets", "max");
    revalidateTag("procurement", "max");

    return Response.json({ success: true });
  } catch (err) {
    console.error("[PROCUREMENT] Failed to delete venue budget:", err);
    return Response.json(
      { error: "Gagal menghapus saldo venue." },
      { status: 500 }
    );
  }
}
