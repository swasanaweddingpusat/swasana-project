import { NextResponse } from "next/server";
import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getRoles } from "@/lib/queries/roles";

export async function GET() {
  const { session, response } = await requirePermissionForRoute({ module: "role_permission", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`roles-list:${session.user.id}`)) return rateLimitResponse();

  try {
    const roles = await getRoles();
    return NextResponse.json(roles);
  } catch {
    return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
  }
}
