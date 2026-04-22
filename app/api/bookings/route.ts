import { getBookings } from "@/lib/queries/bookings";
import { requirePermissionForRoute } from "@/lib/permissions";
import { db } from "@/lib/db";
import type { DataScope } from "@/types/user";

export async function GET() {
  const { session, response } = await requirePermissionForRoute({ module: "booking", action: "view" });
  if (response) return response;

  const profileId = session.user.profileId ?? undefined;
  let dataScope: DataScope = "own";
  if (profileId) {
    const profile = await db.profile.findUnique({ where: { id: profileId }, select: { dataScope: true } });
    if (profile) dataScope = profile.dataScope as DataScope;
  }

  const data = await getBookings(profileId, dataScope);
  return new Response(JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? Number(v) : v)), {
    headers: { "content-type": "application/json" },
  });
}
