import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getVendorCategoriesLite } from "@/lib/queries/vendors";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!apiLimiter.check(`vendors-categories-lite:${session.user.id}`)) return rateLimitResponse();

  try {
    const result = await getVendorCategoriesLite();
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch vendor categories" }, { status: 500 });
  }
}
