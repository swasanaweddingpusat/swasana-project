import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getCategories } from "@/lib/queries/categories";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!apiLimiter.check(`categories:${session.user.id}`)) return rateLimitResponse();

  try {
    const categories = await getCategories();
    return Response.json(categories);
  } catch {
    return Response.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}
