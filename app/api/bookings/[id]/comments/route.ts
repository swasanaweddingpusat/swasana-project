import { NextResponse } from "next/server";
import { requirePermissionForRoute } from "@/lib/permissions";
import { getBookingComments } from "@/lib/queries/booking-comments";
import { getPublicUrl } from "@/lib/r2";

interface RawAttachment { path: string; name: string; size: number; type: string }

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requirePermissionForRoute({ module: "booking", action: "view" });
  if (response) return response;

  const { id } = await params;
  const comments = await getBookingComments(id);

  // Resolve R2 URLs server-side so client doesn't need env var
  const resolved = comments.map((c) => ({
    ...c,
    attachments: Array.isArray(c.attachments)
      ? (c.attachments as unknown as RawAttachment[]).map((a) => ({ ...a, url: getPublicUrl(a.path) }))
      : [],
  }));

  return NextResponse.json(resolved);
}
