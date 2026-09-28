import { NextResponse } from "next/server";
import { getProspectStatuses } from "@/lib/queries/prospect-status";
import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!apiLimiter.check(`prospect-statuses:${session.user.id}`)) return rateLimitResponse();

  try {
    const data = await getProspectStatuses();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch prospect statuses" }, { status: 500 });
  }
}
