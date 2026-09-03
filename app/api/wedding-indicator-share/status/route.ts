import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const { response } = await requirePermissionForRoute({
    module: "vendor-specialist",
    action: "view",
  });
  if (response) return response;

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!apiLimiter.check(`wi-share-status:${ip}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const indicatorId = searchParams.get("indicatorId");
  if (!indicatorId) {
    return NextResponse.json(
      { error: "indicatorId required" },
      { status: 400 }
    );
  }

  try {
    const share = await db.weddingIndicatorShare.findUnique({
      where: { weddingIndicatorId: indicatorId },
      select: {
        token: true,
        accessCode: true,
        status: true,
        viewedAt: true,
        lastEditedAt: true,
        expiresAt: true,
      },
    });

    if (!share) {
      return NextResponse.json({ share: null });
    }

    return NextResponse.json({
      share: {
        token: share.token,
        accessCode: share.accessCode,
        status: share.status,
        viewedAt: share.viewedAt,
        lastEditedAt: share.lastEditedAt,
        expiresAt: share.expiresAt,
      },
    });
  } catch (e) {
    console.error("[wi-share-status]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
