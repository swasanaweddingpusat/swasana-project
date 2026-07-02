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
    // Distinct years by EVENT date — must match buildDateFilter (which filters the
    // list by eventDate range), NOT poYear (the year the PO was created). A booking
    // finalized in Dec 2025 for a Jan 2026 wedding belongs to the "2026" filter.
    // eventDate is a naive UTC timestamp, so EXTRACT(YEAR ...) lines up with the
    // UTC boundaries buildDateFilter uses.
    const result = await db.$queryRaw<Array<{ year: number }>>`
      SELECT DISTINCT EXTRACT(YEAR FROM "eventDate")::int AS year
      FROM bookings
      WHERE "eventDate" IS NOT NULL
      ORDER BY year DESC
    `;

    const years = result.map((row) => row.year);

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
