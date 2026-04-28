import { NextResponse } from "next/server";
import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getUnreadCommentCounts } from "@/lib/queries/booking-comments";

export async function POST(req: Request) {
  const { session, response } = await requirePermissionForRoute({ module: "booking", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`unread-comments:${session.user.id}`)) return rateLimitResponse();

  const profileId = session?.user?.profileId;
  if (!profileId) return NextResponse.json({});

  const { bookingIds } = await req.json() as { bookingIds: string[] };
  if (!Array.isArray(bookingIds) || !bookingIds.length) return NextResponse.json({});

  const counts = await getUnreadCommentCounts(bookingIds, profileId);
  return NextResponse.json(counts);
}
