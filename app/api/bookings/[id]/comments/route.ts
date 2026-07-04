import { NextResponse } from "next/server";
import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getBookingComments } from "@/lib/queries/booking-comments";
import { getPublicUrl } from "@/lib/storage";

interface RawAttachment { path: string; name: string; size: number; type: string }

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requirePermissionForRoute({ module: "booking", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`booking-comments:${session.user.id}`)) return rateLimitResponse();

  const { id } = await params;
  const highlightCommentId = new URL(request.url).searchParams.get("highlight") ?? undefined;
  const comments = await getBookingComments(id, session.user.profileId, { highlightCommentId });

  // Resolve storage URLs server-side so client doesn't need env var
  const resolved = comments.map((c) => ({
    ...c,
    attachments: Array.isArray(c.attachments)
      ? (c.attachments as unknown as RawAttachment[]).map((a) => ({ ...a, url: getPublicUrl(a.path) }))
      : [],
  }));

  return NextResponse.json(resolved);
}
