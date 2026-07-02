import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getAttendanceToday, todayMidnightUTC } from "@/lib/queries/attendance";
import { resolveEmployeeShift } from "@/lib/attendance-helpers";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!apiLimiter.check(`attendance-today:${session.user.id}`)) return rateLimitResponse();

  const profileId = session.user.profileId;
  if (!profileId) {
    return Response.json({ error: "Profile tidak ditemukan" }, { status: 404 });
  }

  try {
    const today = todayMidnightUTC();
    const [attendance, resolved] = await Promise.all([
      getAttendanceToday(profileId),
      resolveEmployeeShift(profileId, today),
    ]);

    return Response.json({
      attendance,
      shift: resolved?.workShift ?? null,
      shiftSource: resolved?.source ?? null,
    });
  } catch {
    return Response.json({ error: "Failed to fetch attendance" }, { status: 500 });
  }
}
