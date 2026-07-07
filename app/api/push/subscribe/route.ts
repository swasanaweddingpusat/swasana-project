import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { pushSubscribeSchema } from "@/lib/validations/push";

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.profileId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!mutationLimiter.check(`push-sub:${session.user.id}:${ip}`)) {
    return rateLimitResponse();
  }

  const parsed = pushSubscribeSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid subscription data" }, { status: 400 });
  }

  const { endpoint, keys } = parsed.data;

  const existing = await db.pushSubscription.findUnique({
    where: { endpoint },
    select: { userId: true },
  });

  if (existing && existing.userId !== session.user.profileId) {
    await db.pushSubscription.delete({ where: { endpoint } });
  }

  await db.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId: session.user.profileId,
      endpoint,
      authKey: keys.auth,
      p256dhKey: keys.p256dh,
      isActive: true,
    },
    update: {
      userId: session.user.profileId,
      authKey: keys.auth,
      p256dhKey: keys.p256dh,
      isActive: true,
      updatedAt: new Date(),
    },
  });

  return Response.json({ success: true });
}
