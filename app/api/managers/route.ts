import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getManagerProfiles } from "@/lib/queries/users";

export async function GET() {
  // Guard: booking:view — semua role yang perlu pilih manager pasti punya ini.
  // Lebih inclusive dari settings-users:view tanpa kehilangan auth check.
  const { session, response } = await requirePermissionForRoute({
    module: "booking",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`managers-list:${session.user.id}`)) return rateLimitResponse();

  try {
    const result = await getManagerProfiles();
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch managers" }, { status: 500 });
  }
}
