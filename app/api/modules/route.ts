import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getAccessibleModules } from "@/lib/queries/modules";

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!apiLimiter.check(`modules:${session.user.id}`)) return rateLimitResponse();

  const modules = await getAccessibleModules(session.user.roleId);
  return Response.json(modules);
}
