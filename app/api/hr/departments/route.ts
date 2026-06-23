import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getDepartments } from "@/lib/queries/departments";

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!apiLimiter.check(`departments-list:${session.user.id}`)) return rateLimitResponse();

  try {
    const result = await getDepartments();
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch departments" }, { status: 500 });
  }
}
