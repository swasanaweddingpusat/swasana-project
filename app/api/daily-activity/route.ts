import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getDailyActivities } from "@/lib/queries/daily-activity";
import { dailyActivityFilterSchema, createDailyActivitySchema } from "@/lib/validations/daily-activity";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { revalidateTag } from "next/cache";
import type { DataScope } from "@/types/user";

export async function GET(req: Request) {
  const { session, response } = await requirePermissionForRoute({
    module: "daily-activity",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`daily-activity-list:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const raw = {
    search: searchParams.get("search") ?? undefined,
    scope: searchParams.get("scope") ?? undefined,
    statusId: searchParams.get("statusId") ?? undefined,
    venueId: searchParams.get("venueId") ?? undefined,
    eventTypeId: searchParams.get("eventTypeId") ?? undefined,
    assignedToId: searchParams.get("assignedToId") ?? undefined,
    page: searchParams.get("page") ?? "1",
    pageSize: searchParams.get("pageSize") ?? "20",
  };

  const parsed = dailyActivityFilterSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "Parameter tidak valid" }, { status: 400 });
  }

  try {
    // dataScope is not stored in the JWT; fetch it from the profile row.
    // This is a single lightweight SELECT — acceptable for per-request identity enforcement.
    const profile = await db.profile.findUnique({
      where: { id: session.user.profileId },
      select: { dataScope: true },
    });
    const caller = {
      profileId: session.user.profileId,
      dataScope: (profile?.dataScope ?? "own") as DataScope,
    };
    const result = await getDailyActivities(parsed.data, caller);
    return Response.json(result);
  } catch {
    return Response.json({ error: "Gagal mengambil data daily activity" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { session, response } = await requirePermissionForRoute({
    module: "daily-activity",
    action: "create",
  });
  if (response) return response;
  if (!mutationLimiter.check(`create-daily-activity:${session.user.id}`)) return rateLimitResponse();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Request body tidak valid" }, { status: 400 });
  }

  const parsed = createDailyActivitySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0].message },
      { status: 422 }
    );
  }

  const {
    name,
    instansi,
    contactNumbers,
    email,
    address,
    eventDate,
    time,
    estimatedPax,
    budgetRange,
    notes,
    category,
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
      db.dailyActivity.create({
        data: {
          name,
          instansi: instansi || null,
          contactNumbers,
          email: email || null,
          address: address || null,
          eventDate: eventDate ? new Date(eventDate) : null,
          time: time || null,
          estimatedPax: estimatedPax ?? null,
          budgetRange: budgetRange || null,
          notes: notes || null,
          category,
          weddingSession: weddingSession ?? null,
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

    revalidateTag("daily-activity", "max");

    return Response.json(lead, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal menyimpan daily activity" }, { status: 500 });
  }
}
