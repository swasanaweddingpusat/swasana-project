import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { revalidateTag } from "next/cache";
import { getLeadStatuses } from "@/lib/queries/leads";
import { createLeadStatusSchema } from "@/lib/validations/lead";

// ─── GET /api/lead-statuses ───────────────────────────────────────────────────

export async function GET(_req: Request) {
  const { session, response } = await requirePermissionForRoute({
    module: "leads",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`lead-statuses:${session.user.id}`)) return rateLimitResponse();

  try {
    const statuses = await getLeadStatuses();
    return Response.json(statuses);
  } catch {
    return Response.json({ error: "Gagal mengambil lead statuses" }, { status: 500 });
  }
}

// ─── POST /api/lead-statuses ──────────────────────────────────────────────────

export async function POST(req: Request) {
  const { session, response } = await requirePermissionForRoute({
    module: "settings-lead-status",
    action: "create",
  });
  if (response) return response;
  if (!mutationLimiter.check(`create-lead-status:${session.user.id}`)) return rateLimitResponse();

  const body: unknown = await req.json();
  const parsed = createLeadStatusSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const [status] = await db.$transaction([
      db.leadStatus.create({
        data: {
          name: parsed.data.name,
          color: parsed.data.color,
          sortOrder: parsed.data.sortOrder,
          isDefault: parsed.data.isDefault,
          isFinal: parsed.data.isFinal,
        },
        select: { id: true, name: true, color: true, sortOrder: true, isDefault: true, isFinal: true, isSystem: true, isActive: true },
      }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "lead_status.created",
      result: "success",
      entityType: "LeadStatus",
      entityId: status.id,
    });

    revalidateTag("lead-statuses", "max");

    return Response.json(status, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal membuat status." }, { status: 500 });
  }
}
