import { requireAnyPermissionForRoute } from "@/lib/permissions";
import { apiLimiter, mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { revalidateTag } from "next/cache";
import { getDailyActivitySegments } from "@/lib/queries/daily-activity";
import { createDailyActivitySegmentSchema } from "@/lib/validations/daily-activity-segment";

// ─── GET /api/daily-activity-segments ─────────────────────────────────────────

export async function GET(_req: Request) {
  // Also accepts daily-activity:view — sales users fetch this list from the activity form drawer.
  const { session, response } = await requireAnyPermissionForRoute([
    { module: "settings-daily-activity-segment", action: "view" },
    { module: "daily-activity", action: "view" },
  ]);
  if (response) return response;
  if (!apiLimiter.check(`daily-activity-segments:${session.user.id}`)) return rateLimitResponse();

  try {
    const segments = await getDailyActivitySegments();
    return Response.json(segments);
  } catch {
    return Response.json({ error: "Gagal mengambil segment activity" }, { status: 500 });
  }
}

// ─── POST /api/daily-activity-segments ────────────────────────────────────────

export async function POST(req: Request) {
  // Also accepts daily-activity:create — sales users can add segments inline from the activity form.
  const { session, response } = await requireAnyPermissionForRoute([
    { module: "settings-daily-activity-segment", action: "create" },
    { module: "daily-activity", action: "create" },
  ]);
  if (response) return response;
  if (!mutationLimiter.check(`create-daily-activity-segment:${session.user.id}`)) return rateLimitResponse();

  const body: unknown = await req.json();
  const parsed = createDailyActivitySegmentSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const [segment] = await db.$transaction([
      db.dailyActivitySegment.create({
        data: {
          name: parsed.data.name,
          isActive: parsed.data.isActive,
          sortOrder: parsed.data.sortOrder,
        },
        select: { id: true, name: true, isActive: true, sortOrder: true },
      }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "daily_activity_segment.created",
      result: "success",
      entityType: "DailyActivitySegment",
      entityId: segment.id,
    });

    revalidateTag("daily-activity-segments", "max");

    return Response.json(segment, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal membuat segment." }, { status: 500 });
  }
}
