import { NextResponse } from "next/server";
import { getOrderStatuses } from "@/lib/queries/order-status";
import { requirePermissionForRoute } from "@/lib/permissions";

export async function GET() {
  const { response } = await requirePermissionForRoute({ module: "settings", action: "view" });
  if (response) return response;

  const data = await getOrderStatuses();
  return NextResponse.json(data);
}
