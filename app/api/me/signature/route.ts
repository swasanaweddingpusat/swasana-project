import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!apiLimiter.check(`me-signature:${session.user.id}`)) return rateLimitResponse();

  const profile = await db.profile.findUnique({
    where: { userId: session.user.id },
    select: { defaultSignature: true },
  });

  return Response.json({ defaultSignature: profile?.defaultSignature ?? null });
}
