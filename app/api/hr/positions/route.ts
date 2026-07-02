import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getPositions } from "@/lib/queries/positions";

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!apiLimiter.check(`positions-list:${session.user.id}`)) return rateLimitResponse();

  try {
    const url = new URL(req.url);
    const departmentId = url.searchParams.get("departmentId") ?? undefined;
    const result = await getPositions(departmentId);
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch positions" }, { status: 500 });
  }
}
