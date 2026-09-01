import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getVendors } from "@/lib/queries/vendors";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!apiLimiter.check(`vendors-list-paginated:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || 10));
  const search = searchParams.get("search") ?? "";
  const categoryId = searchParams.get("categoryId") ?? undefined;

  try {
    const result = await getVendors(page, pageSize, search, categoryId);
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch vendors" }, { status: 500 });
  }
}
