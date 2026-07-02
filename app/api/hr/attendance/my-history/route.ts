import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getMyAttendanceHistory } from "@/lib/queries/attendance";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!apiLimiter.check(`hr-my-history:${session.user.id}`)) return rateLimitResponse();

  const profileId = session.user.profileId;
  if (!profileId) {
    return Response.json({ error: "Profile tidak ditemukan" }, { status: 404 });
  }

  try {
    const history = await getMyAttendanceHistory(profileId);
    return Response.json(history);
  } catch {
    return Response.json({ error: "Gagal mengambil riwayat absensi" }, { status: 500 });
  }
}
