import { NextResponse } from "next/server";
import { cleanupOldDrafts } from "@/actions/booking-draft";

/**
 * POST /api/admin/cleanup-drafts
 *
 * Deletes booking drafts older than 7 days (configurable via ?days=N).
 * Secured with CLEANUP_SECRET — must NOT reuse AUTH_SECRET.
 *
 * Intended for: cron job / scheduled task (e.g. daily via Vercel Cron or GitHub Actions).
 *
 * curl -X POST \
 *   -H "Authorization: Bearer $CLEANUP_SECRET" \
 *   https://app.swasana.com/api/admin/cleanup-drafts
 */
export async function POST(request: Request): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CLEANUP_SECRET;

  if (!secret) {
    return NextResponse.json({ error: "CLEANUP_SECRET not configured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get("days");
    const cutoffDays = daysParam ? Math.max(1, Math.min(30, parseInt(daysParam, 10) || 7)) : 7;

    const result = await cleanupOldDrafts(cutoffDays);

    return NextResponse.json({
      success: true,
      deleted: result.deleted,
      cutoffDays,
    });
  } catch (error) {
    console.error("[cleanup-drafts] Error:", error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
