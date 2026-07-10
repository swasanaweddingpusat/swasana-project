import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter } from "@/lib/rate-limit";
import { getWeddingIndicatorById } from "@/lib/queries/weddingIndicators";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, response } = await requirePermissionForRoute({
    module: "vendor-specialist",
    action: "view",
  });

  if (response) return response;

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!apiLimiter.check(`wedding-indicators-detail:${ip}`)) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  try {
    const { id } = await params;
    const indicator = await getWeddingIndicatorById(id);

    if (!indicator) {
      return NextResponse.json(
        { error: "Wedding indicator not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(indicator, {
      headers: {
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    console.error("Wedding indicator GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
