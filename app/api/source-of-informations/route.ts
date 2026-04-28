import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!apiLimiter.check(`source-of-info:${session.user.id}`)) return rateLimitResponse();

  const items = await db.sourceOfInformation.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  return Response.json(items);
}
