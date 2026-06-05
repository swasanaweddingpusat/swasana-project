import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { revalidateTag } from "next/cache";
import { getMaintenancePriorities } from "@/lib/queries/maintenance";
import { createMaintenancePrioritySchema } from "@/lib/validations/maintenance";

// ─── GET /api/maintenance-priorities ─────────────────────────────────────────

export async function GET(_req: Request) {
  const { session, response } = await requirePermissionForRoute({
    module: "maintenance",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`maintenance-priorities:${session.user.id}`)) return rateLimitResponse();

  try {
    const priorities = await getMaintenancePriorities();
    return Response.json(priorities);
  } catch {
    return Response.json({ error: "Gagal mengambil prioritas maintenance" }, { status: 500 });
  }
}

// ─── POST /api/maintenance-priorities ────────────────────────────────────────

export async function POST(req: Request) {
  const { session, response } = await requirePermissionForRoute({
    module: "settings-maintenance-priority",
    action: "create",
  });
  if (response) return response;
  if (!mutationLimiter.check(`create-maintenance-priority:${session.user.id}`)) return rateLimitResponse();

  const body: unknown = await req.json();
  const parsed = createMaintenancePrioritySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const [priority] = await db.$transaction([
      db.maintenancePriority.create({
        data: {
          name: parsed.data.name,
          deadlineDays: parsed.data.deadlineDays,
        },
        select: { id: true, name: true, deadlineDays: true, createdAt: true },
      }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "maintenance_priority.created",
      result: "success",
      entityType: "MaintenancePriority",
      entityId: priority.id,
    });

    revalidateTag("maintenance-priorities", "max");

    return Response.json(priority, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal membuat prioritas." }, { status: 500 });
  }
}
