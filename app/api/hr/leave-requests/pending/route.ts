import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getPendingForManager } from "@/lib/queries/leaveRequests";

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!apiLimiter.check(`leave-requests-pending:${session.user.id}`)) return rateLimitResponse();

  const profileId = session.user.profileId;
  if (!profileId) return Response.json({ error: "Profile tidak ditemukan" }, { status: 400 });

  try {
    const result = await getPendingForManager(profileId);
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to fetch pending leave requests" }, { status: 500 });
  }
}
