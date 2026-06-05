import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { revalidateTag } from "next/cache";
import { getMaintenanceStatuses } from "@/lib/queries/maintenance";
import { createMaintenanceStatusSchema } from "@/lib/validations/maintenance";

// ─── GET /api/maintenance-statuses ───────────────────────────────────────────

export async function GET(_req: Request) {
  const { session, response } = await requirePermissionForRoute({
    module: "maintenance",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`maintenance-statuses:${session.user.id}`)) return rateLimitResponse();

  try {
    const statuses = await getMaintenanceStatuses();
    return Response.json(statuses);
  } catch {
    return Response.json({ error: "Gagal mengambil status maintenance" }, { status: 500 });
  }
}

// ─── POST /api/maintenance-statuses ──────────────────────────────────────────

export async function POST(req: Request) {
  const { session, response } = await requirePermissionForRoute({
    module: "settings-maintenance-status",
    action: "create",
  });
  if (response) return response;
  if (!mutationLimiter.check(`create-maintenance-status:${session.user.id}`)) return rateLimitResponse();

  const body: unknown = await req.json();
  const parsed = createMaintenanceStatusSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const [status] = await db.$transaction([
      db.maintenanceStatus.create({
        data: {
          name: parsed.data.name,
          order: parsed.data.order,
        },
        select: { id: true, name: true, order: true, createdAt: true },
      }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "maintenance_status.created",
      result: "success",
      entityType: "MaintenanceStatus",
      entityId: status.id,
    });

    revalidateTag("maintenance-statuses", "max");

    return Response.json(status, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal membuat status." }, { status: 500 });
  }
}
