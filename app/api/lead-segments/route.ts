import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { revalidateTag } from "next/cache";
import { getLeadSegments } from "@/lib/queries/leads";
import { createLeadSegmentSchema } from "@/lib/validations/lead-segment";

// ─── GET /api/lead-segments ───────────────────────────────────────────────────

export async function GET(_req: Request) {
  const { session, response } = await requirePermissionForRoute({
    module: "settings-lead-segment",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`lead-segments:${session.user.id}`)) return rateLimitResponse();

  try {
    const segments = await getLeadSegments();
    return Response.json(segments);
  } catch {
    return Response.json({ error: "Gagal mengambil lead segments" }, { status: 500 });
  }
}

// ─── POST /api/lead-segments ──────────────────────────────────────────────────

export async function POST(req: Request) {
  const { session, response } = await requirePermissionForRoute({
    module: "settings-lead-segment",
    action: "create",
  });
  if (response) return response;
  if (!mutationLimiter.check(`create-lead-segment:${session.user.id}`)) return rateLimitResponse();

  const body: unknown = await req.json();
  const parsed = createLeadSegmentSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const [segment] = await db.$transaction([
      db.leadSegment.create({
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
      action: "lead_segment.created",
      result: "success",
      entityType: "LeadSegment",
      entityId: segment.id,
    });

    revalidateTag("lead-segments", "max");

    return Response.json(segment, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal membuat segment." }, { status: 500 });
  }
}
