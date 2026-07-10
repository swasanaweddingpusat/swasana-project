import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter } from "@/lib/rate-limit";
import { weddingIndicatorFilterSchema } from "@/lib/validations/weddingIndicator";
import { getWeddingIndicators } from "@/lib/queries/weddingIndicators";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { session, response } = await requirePermissionForRoute({
    module: "vendor-specialist",
    action: "view",
  });

  if (response) return response;

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!apiLimiter.check(`wedding-indicators-list:${ip}`)) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const filters = weddingIndicatorFilterSchema.parse({
      page: searchParams.get("page") || "1",
      limit: searchParams.get("limit") || "10",
      search: searchParams.get("search"),
      venueId: searchParams.get("venueId"),
      dateFrom: searchParams.get("dateFrom"),
      dateTo: searchParams.get("dateTo"),
    });

    const result = await getWeddingIndicators(filters);

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    console.error("Wedding indicators GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
