import { db } from "@/lib/db";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 5 * 60 * 1000;

export async function POST(request: Request) {
  const { email } = await request.json() as { email?: string };
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
