import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { requirePermissionForRoute } from "@/lib/permissions";
import { getDailyActivities } from "@/lib/queries/daily-activity";
import { dailyActivityFilterSchema } from "@/lib/validations/daily-activity";
import { db } from "@/lib/db";
import type { DataScope } from "@/types/user";

export async function GET(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "daily-activity",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`daily-activities:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const raw = {
    search: searchParams.get("search") ?? undefined,
    progressStatus: searchParams.get("progressStatus") ?? undefined,
    segmentId: searchParams.get("segmentId") ?? undefined,
    salesId: searchParams.get("salesId") ?? undefined,
    page: searchParams.get("page") ?? "1",
    pageSize: searchParams.get("pageSize") ?? "10",
  };

  const parsed = dailyActivityFilterSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "Parameter tidak valid" }, { status: 400 });
  }

  try {
    // dataScope is not stored in the JWT; fetch it from the profile row.
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
