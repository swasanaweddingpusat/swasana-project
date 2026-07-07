import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { pushUnsubscribeSchema } from "@/lib/validations/push";

export async function DELETE(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.profileId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!mutationLimiter.check(`push-unsub:${session.user.id}:${ip}`)) {
    return rateLimitResponse();
  }

  const parsed = pushUnsubscribeSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  await db.pushSubscription.deleteMany({
    where: {
      endpoint: parsed.data.endpoint,
      userId: session.user.profileId,
    },
  });

  return Response.json({ success: true });
}
