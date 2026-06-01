import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getLeads } from "@/lib/queries/leads";
import { leadFilterSchema, createLeadSchema } from "@/lib/validations/lead";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { revalidateTag } from "next/cache";

export async function GET(req: Request) {
  const { session, response } = await requirePermissionForRoute({
    module: "leads",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`leads-list:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const raw = {
    search: searchParams.get("search") ?? undefined,
    statusId: searchParams.get("statusId") ?? undefined,
    venueId: searchParams.get("venueId") ?? undefined,
    eventTypeId: searchParams.get("eventTypeId") ?? undefined,
    assignedToId: searchParams.get("assignedToId") ?? undefined,
    page: searchParams.get("page") ?? "1",
    pageSize: searchParams.get("pageSize") ?? "20",
  };

  const parsed = leadFilterSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "Parameter tidak valid" }, { status: 400 });
  }

  try {
    const result = await getLeads(parsed.data);
    return Response.json(result);
  } catch {
    return Response.json({ error: "Gagal mengambil data leads" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { session, response } = await requirePermissionForRoute({
    module: "leads",
    action: "create",
  });
  if (response) return response;
  if (!mutationLimiter.check(`create-lead:${session.user.id}`)) return rateLimitResponse();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Request body tidak valid" }, { status: 400 });
  }

  const parsed = createLeadSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0].message },
      { status: 422 }
    );
  }

  const {
    name,
    contactNumbers,
    email,
    address,
    eventDate,
    time,
    estimatedPax,
    budgetRange,
    notes,
    weddingSession,
    venueId,
    packageId,
    eventTypeId,
    sourceOfInformationId,
    assignedToId,
    statusId,
  } = parsed.data;

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  try {
    const [lead] = await db.$transaction([
      db.lead.create({
        data: {
          name,
          contactNumbers,
          email: email || null,
          address: address || null,
          eventDate: eventDate ? new Date(eventDate) : null,
          time: time || null,
          estimatedPax: estimatedPax ?? null,
          budgetRange: budgetRange || null,
          notes: notes || null,
          weddingSession,
          venueId: venueId || null,
          packageId: packageId || null,
          eventTypeId: eventTypeId || null,
          sourceOfInformationId: sourceOfInformationId || null,
          assignedToId: assignedToId || null,
          statusId,
          createdById: session.user.profileId,
        },
        select: { id: true, name: true },
      }),
    ]);

    await logAudit({
      userId: session.user.profileId,
      action: "lead.created",
      result: "success",
      entityType: "Lead",
      entityId: lead.id,
      ipAddress: ip,
    });

    revalidateTag("leads", "max");

    return Response.json(lead, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal menyimpan lead" }, { status: 500 });
  }
}
