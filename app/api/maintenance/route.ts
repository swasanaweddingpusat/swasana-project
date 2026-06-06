import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { revalidateTag } from "next/cache";
import { getMaintenanceTickets } from "@/lib/queries/maintenance";
import {
  maintenanceFilterSchema,
  createMaintenanceTicketSchema,
} from "@/lib/validations/maintenance";

// ─── GET /api/maintenance ─────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { session, response } = await requirePermissionForRoute({
    module: "maintenance",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`maintenance-list:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);

  const rawFilter = {
    type: searchParams.get("type") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    venueId: searchParams.get("venueId") ?? undefined,
    brandId: searchParams.get("brandId") ?? undefined,
    statusId: searchParams.get("statusId") ?? undefined,
    priorityId: searchParams.get("priorityId") ?? undefined,
    categoryId: searchParams.get("categoryId") ?? undefined,
    assignedToId: searchParams.get("assignedToId") ?? undefined,
    roleId: searchParams.get("roleId") ?? undefined,
    isVendor: searchParams.get("isVendor") ?? undefined,
    isAudit: searchParams.get("isAudit") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  };

  const parsed = maintenanceFilterSchema.safeParse(rawFilter);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const result = await getMaintenanceTickets(parsed.data);
    return Response.json(result);
  } catch {
    return Response.json({ error: "Gagal mengambil tiket maintenance" }, { status: 500 });
  }
}

// ─── POST /api/maintenance ────────────────────────────────────────────────────

export async function POST(req: Request) {
  const { session, response } = await requirePermissionForRoute({
    module: "maintenance",
    action: "create",
  });
  if (response) return response;
  if (!mutationLimiter.check(`create-maintenance:${session.user.id}`)) return rateLimitResponse();

  const body: unknown = await req.json();
  const parsed = createMaintenanceTicketSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // Look up priority.deadlineDays to calculate estimateDate
  const priority = await db.maintenancePriority.findUnique({
    where: { id: parsed.data.priorityId },
    select: { deadlineDays: true },
  });
  if (!priority) {
    return Response.json({ error: "Prioritas tidak ditemukan." }, { status: 400 });
  }

  const estimateDate = new Date();
  estimateDate.setDate(estimateDate.getDate() + priority.deadlineDays);

  try {
    const [ticket] = await db.$transaction([
      db.maintenanceTicket.create({
        data: {
          type: parsed.data.type,
          description: parsed.data.description,
          venueId: parsed.data.venueId,
          categoryId: parsed.data.categoryId,
          priorityId: parsed.data.priorityId,
          statusId: parsed.data.statusId,
          assignedToId: parsed.data.assignedToId ?? null,
          isVendor: parsed.data.isVendor,
          isAudit: parsed.data.isAudit,
          frequency: parsed.data.frequency ?? null,
          nextDueDate: parsed.data.nextDueDate ? new Date(parsed.data.nextDueDate) : null,
          estimateDate,
          createdById: session.user.profileId,
        },
        select: { id: true, type: true, description: true, estimateDate: true, createdAt: true },
      }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "maintenance.created",
      result: "success",
      entityType: "MaintenanceTicket",
      entityId: ticket.id,
    });

    revalidateTag("maintenance", "max");

    return Response.json(ticket, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal membuat tiket maintenance." }, { status: 500 });
  }
}
