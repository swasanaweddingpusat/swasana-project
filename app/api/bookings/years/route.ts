import { db } from "@/lib/db";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";

/**
 * GET /api/bookings/years
 * Returns distinct years from poYear column (excluding NULL).
 * Used to populate year filter dropdown.
 */
export async function GET(request: Request) {
  // Auth check — must be logged in
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  // Rate limit
  if (!apiLimiter.check(`bookings-years:${session.user.id}`)) {
    return rateLimitResponse();
  }

  try {
    // Fetch distinct years from poYear column
    const result = await db.$queryRaw<Array<{ poYear: number }>>`
      SELECT DISTINCT "poYear"
      FROM bookings
      WHERE "poYear" IS NOT NULL
      ORDER BY "poYear" DESC
    `;

    const years = result.map((row) => row.poYear);

    return new Response(JSON.stringify({ years }), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch years" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}
