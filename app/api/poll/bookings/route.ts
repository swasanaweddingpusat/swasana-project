import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
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

  // dataScope already lives on the JWT/session (lib/auth.ts) — no extra DB round-trip.
  const dataScope: DataScope = session.user.dataScope ?? "own";

  try {
    const data = await getPollData(session.user.profileId, dataScope);
    return Response.json(data);
  } catch (e) {
    // P1017 = Neon connection closed (pool exhausted under heavy load) — transient,
    // client should retry. Return 503 so the poller backs off rather than logging 500.
    const code = (e as { code?: string })?.code;
    if (code === "P1017") {
      return Response.json({ error: "Service temporarily unavailable" }, { status: 503 });
    }
    throw e;
  }
}
