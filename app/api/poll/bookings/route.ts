import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { getPollData } from "@/lib/queries/poll";
import type { DataScope } from "@/types/user";

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.profileId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!apiLimiter.check(`poll:${session.user.id}:${ip}`)) {
    return rateLimitResponse();
  }

  let dataScope: DataScope = "own";
  const profile = await db.profile.findUnique({
    where: { id: session.user.profileId },
    select: { dataScope: true },
  });
  if (profile) {
    dataScope = profile.dataScope as DataScope;
  }

  const data = await getPollData(session.user.profileId, dataScope);
  return Response.json(data);
}
