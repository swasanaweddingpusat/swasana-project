import { db } from "@/lib/db";
import { authLimiter, rateLimitResponse } from "@/lib/rate-limit";

// Lockout window must match lib/auth.ts LOCKOUT_WINDOW_MS (5 minutes, DB-based).
// authLimiter uses 15-minute window (in-memory) — the two are intentionally different:
// DB lockout is persistent across cold starts; in-memory limiter is a fast pre-check
// that protects the DB query itself from being abused.
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 5 * 60 * 1000;

export async function POST(request: Request): Promise<Response> {
  const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown";
  if (!authLimiter.check(`check-lockout:${ip}`)) return rateLimitResponse();

  const body = await request.json() as { email?: string };
  const email = typeof body.email === "string" ? body.email.trim() : "";

  // Return generic locked:false for empty/invalid email — no enumeration signal
  if (!email) return Response.json({ locked: false });

  try {
    const since = new Date(Date.now() - LOCKOUT_WINDOW_MS);
    const recentFailures = await db.activityLog.count({
      where: {
        action: "auth.login_failed",
        entityId: email,
        createdAt: { gte: since },
      },
    });

    // If zero failures found (email not in ActivityLog OR genuinely no failures),
    // both cases return { locked: false } — no enumeration possible.
    if (recentFailures >= MAX_FAILED_ATTEMPTS) {
      const oldest = await db.activityLog.findFirst({
        where: { action: "auth.login_failed", entityId: email, createdAt: { gte: since } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      });
      const unlocksAt = oldest ? new Date(oldest.createdAt.getTime() + LOCKOUT_WINDOW_MS) : null;
      const remainingMs = unlocksAt ? Math.max(0, unlocksAt.getTime() - Date.now()) : 0;
      const remainingMin = Math.ceil(remainingMs / 60000);

      return Response.json({ locked: true, remainingMin });
    }

    return Response.json({ locked: false });
  } catch {
    return Response.json({ locked: false });
  }
}
