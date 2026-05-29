import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getMentionableUsers } from "@/lib/queries/users";

export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rateLimitKey = session.user.id ?? `ip:${ip}`;
  if (!apiLimiter.check(`mentionable:${rateLimitKey}`)) return rateLimitResponse();

  try {
    const users = await getMentionableUsers();
    return Response.json(users);
  } catch {
    return Response.json({ error: "Failed to fetch mentionable users" }, { status: 500 });
  }
}
