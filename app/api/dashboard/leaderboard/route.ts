import { z } from "zod";
import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getSalesLeaderboardRaw } from "@/lib/queries/dashboard";

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.profileId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!apiLimiter.check(`dashboard-leaderboard:${session.user.id}`)) {
    return rateLimitResponse();
  }

  // Period params accepted for API compatibility but no longer scope the
  // leaderboard — revenue is all-time while the general period filter is disabled.
  const querySchema = z.object({
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
  });

  const qParsed = querySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  if (!qParsed.success) {
    return Response.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  // isSuperAdmin is already on the JWT (session.user) — no DB round-trip.
  const isAdmin = session.user.isSuperAdmin;
  const profileId = isAdmin ? undefined : session.user.profileId;

  const leaderboard = await getSalesLeaderboardRaw(profileId);
  return Response.json(leaderboard);
}
