import { NextResponse } from "next/server";
import { getOrderStatuses } from "@/lib/queries/order-status";
import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";

export async function GET() {
  const { session, response } = await requirePermissionForRoute({ module: "settings", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`order-statuses:${session.user.id}`)) return rateLimitResponse();

  try {
    const data = await getOrderStatuses();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch order statuses" }, { status: 500 });
  }
}
