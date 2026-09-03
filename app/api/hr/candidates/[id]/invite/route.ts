import { db } from "@/lib/db";
import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "hr-recruitment",
    action: "view",
  });
  if (response) return response;

  if (!apiLimiter.check(`candidate-invite-get:${session.user.id}`)) return rateLimitResponse();

  const { id } = await params;

  const invite = await db.candidateInvite.findUnique({
    where: { candidateId: id },
    select: { token: true, accessCode: true, status: true },
  });

  return Response.json({ invite });
}
