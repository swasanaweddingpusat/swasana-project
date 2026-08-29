import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!apiLimiter.check(`me-profile:${session.user.id}`)) return rateLimitResponse();

  const profile = await db.profile.findUnique({
    where: { userId: session.user.id },
    select: {
      fullName: true,
      department: { select: { id: true, name: true } },
      position: { select: { id: true, name: true } },
    },
  });

  return Response.json(profile ?? { fullName: null, department: null, position: null });
}
