import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getAttendanceToday } from "@/lib/queries/attendance";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!apiLimiter.check(`hr-today:${session.user.id}`)) return rateLimitResponse();

  const profileId = session.user.profileId;
  if (!profileId) {
    return Response.json({ error: "Profile tidak ditemukan" }, { status: 404 });
  }

  try {
    const attendance = await getAttendanceToday(profileId);
    return Response.json(attendance);
  } catch {
    return Response.json({ error: "Gagal mengambil data absensi" }, { status: 500 });
  }
}
