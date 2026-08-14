import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { revalidateTag } from "next/cache";
import { createVenueBudgetSchema } from "@/lib/validations/procurement";
import { getVenueBudgetList } from "@/lib/queries/procurement";

export async function GET(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "procurement-budget",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`venue-budget-list:${session.user.id}`))
    return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20)
  );

  try {
    const result = await getVenueBudgetList(period, page, limit);
    return Response.json(result);
  } catch (err) {
    console.error("[PROCUREMENT] Failed to list venue budgets:", err);
    return Response.json(
      { error: "Gagal mengambil data saldo venue" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "procurement-budget",
    action: "create",
  });
  if (response) return response;
  if (!mutationLimiter.check(`create-venue-budget:${session.user.id}`))
    return rateLimitResponse();

  const body: unknown = await req.json();
  const parsed = createVenueBudgetSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  const existing = await db.procurementVenueBudget.findUnique({
    where: {
      venueId_period: {
        venueId: parsed.data.venueId,
        period: parsed.data.period,
      },
    },
    select: { id: true },
  });

  if (existing) {
    return Response.json(
      { error: "Saldo venue untuk periode ini sudah ada. Gunakan edit untuk mengubah." },
      { status: 409 }
    );
  }

  try {
    const [item] = await db.$transaction([
      db.procurementVenueBudget.create({
        data: {
          venueId: parsed.data.venueId,
          budgetAmount: parsed.data.budgetAmount,
          period: parsed.data.period,
          note: parsed.data.note ?? null,
          updatedById: session.user.profileId,
        },
        select: {
          id: true,
          venueId: true,
          budgetAmount: true,
          period: true,
          createdAt: true,
        },
      }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "procurement.venue_budget.created",
      result: "success",
      entityType: "ProcurementVenueBudget",
      entityId: item.id,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });

    revalidateTag("procurement-budgets", "max");
    revalidateTag("procurement", "max");

    return Response.json(item, { status: 201 });
  } catch (err) {
    console.error("[PROCUREMENT] Failed to create venue budget:", err);
    return Response.json(
      { error: "Gagal membuat saldo venue" },
      { status: 500 }
    );
  }
}
