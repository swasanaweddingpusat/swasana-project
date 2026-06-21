import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getLeadById } from "@/lib/queries/leads";
import { updateLeadSchema } from "@/lib/validations/lead";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { revalidateTag } from "next/cache";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, response } = await requirePermissionForRoute({
    module: "leads",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`lead-detail:${session.user.id}`)) return rateLimitResponse();

  const { id } = await params;
  const lead = await getLeadById(id);
  if (!lead) return Response.json({ error: "Lead tidak ditemukan" }, { status: 404 });

  return Response.json(lead);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, response } = await requirePermissionForRoute({
    module: "leads",
    action: "edit",
  });
  if (response) return response;
  if (!mutationLimiter.check(`update-lead:${session.user.id}`)) return rateLimitResponse();

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Request body tidak valid" }, { status: 400 });
  }

  const parsed = updateLeadSchema.safeParse({ ...body, id });
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0].message },
      { status: 422 }
    );
  }

  const { id: _id, ...fields } = parsed.data;
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  try {
    const [lead] = await db.$transaction([
      db.lead.update({
        where: { id },
        data: {
          ...(fields.name !== undefined && { name: fields.name }),
          ...(fields.instansi !== undefined && { instansi: fields.instansi || null }),
          ...(fields.contactNumbers !== undefined && { contactNumbers: fields.contactNumbers }),
          ...(fields.email !== undefined && { email: fields.email || null }),
          ...(fields.address !== undefined && { address: fields.address || null }),
          ...(fields.eventDate !== undefined && {
            eventDate: fields.eventDate ? new Date(fields.eventDate) : null,
          }),
          ...(fields.estimatedPax !== undefined && { estimatedPax: fields.estimatedPax ?? null }),
          ...(fields.budgetRange !== undefined && { budgetRange: fields.budgetRange || null }),
          ...(fields.notes !== undefined && { notes: fields.notes || null }),
          ...(fields.venueId !== undefined && { venueId: fields.venueId || null }),
          ...(fields.packageId !== undefined && { packageId: fields.packageId || null }),
          ...(fields.eventTypeId !== undefined && { eventTypeId: fields.eventTypeId || null }),
          ...(fields.sourceOfInformationId !== undefined && {
            sourceOfInformationId: fields.sourceOfInformationId || null,
          }),
          ...(fields.weddingSession !== undefined && { weddingSession: fields.weddingSession }),
          ...(fields.assignedToId !== undefined && { assignedToId: fields.assignedToId || null }),
          ...(fields.statusId !== undefined && { statusId: fields.statusId }),
        },
        select: { id: true, name: true },
      }),
    ]);

    await logAudit({
      userId: session.user.profileId,
      action: "lead.updated",
      result: "success",
      entityType: "Lead",
      entityId: id,
      ipAddress: ip,
    });

    revalidateTag("leads", "max");

    return Response.json(lead);
  } catch {
    return Response.json({ error: "Gagal mengupdate lead" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, response } = await requirePermissionForRoute({
    module: "leads",
    action: "delete",
  });
  if (response) return response;
  if (!mutationLimiter.check(`delete-lead:${session.user.id}`)) return rateLimitResponse();

  const { id } = await params;
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  try {
    await db.$transaction([
      db.lead.delete({ where: { id } }),
    ]);

    await logAudit({
      userId: session.user.profileId,
      action: "lead.deleted",
      result: "success",
      entityType: "Lead",
      entityId: id,
      ipAddress: ip,
    });

    revalidateTag("leads", "max");

    return new Response(null, { status: 204 });
  } catch {
    return Response.json({ error: "Gagal menghapus lead" }, { status: 500 });
  }
}
