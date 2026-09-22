// FILE: app/api/kpi-insentif/profiles/route.ts

import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";

export async function GET(_req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "kpi-assignment",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`kpi-profiles:${session.user.id}`)) return rateLimitResponse();

  const profiles = await db.profile.findMany({
    where: { status: "active" },
    select: {
      id: true,
      fullName: true,
      role: {
        select: { name: true },
      },
    },
    orderBy: { fullName: "asc" },
    take: 500,
  });

  const result = profiles.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    roleName: p.role?.name ?? null,
    venueId: null as string | null,
    venueName: null as string | null,
  }));

  return Response.json(result);
}
