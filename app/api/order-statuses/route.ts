import { NextResponse } from "next/server";
import { getOrderStatuses } from "@/lib/queries/order-status";
import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!apiLimiter.check(`order-statuses:${session.user.id}`)) return rateLimitResponse();

  try {
    const data = await getOrderStatuses();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch order statuses" }, { status: 500 });
  }
}
