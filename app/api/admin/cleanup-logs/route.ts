import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Cleanup audit logs older than 90 days
// Call this endpoint via a cron job or scheduled task
export async function POST(request: Request) {
  // Simple secret check to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CLEANUP_SECRET ?? process.env.NEXTAUTH_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    const result = await db.activityLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    return NextResponse.json({
      success: true,
      deleted: result.count,
      cutoffDate: cutoffDate.toISOString(),
    });
  } catch (error) {
    console.error("[cleanup-logs] Error:", error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
