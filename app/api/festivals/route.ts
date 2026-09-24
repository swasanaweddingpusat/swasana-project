import { auth } from "@/lib/auth";
import { z } from "zod";
import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { revalidateTag } from "next/cache";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!apiLimiter.check(`festivals:${session.user.id}`)) return rateLimitResponse();

  const items = await db.festival.findMany({
    select: { id: true, name: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return Response.json(items);
}

// ─── POST /api/festivals ─────────────────────────────────────────

const createSchema = z.object({ name: z.string().min(1, "Nama wajib diisi").max(100) });

export async function POST(req: Request) {
  const { session, response } = await requirePermissionForRoute({ module: "guestbook", action: "create" });
  if (response) return response;
  if (!mutationLimiter.check(`create-festival:${session.user.id}`)) return rateLimitResponse();

  const body: unknown = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const [item] = await db.$transaction([
      db.festival.create({
        data: { name: parsed.data.name.trim() },
        select: { id: true, name: true, createdAt: true },
      }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "festival.created",
      result: "success",
      entityType: "Festival",
      entityId: item.id,
    });

    revalidateTag("festivals", "max");

    return Response.json(item, { status: 201 });
  } catch {
    return Response.json({ error: "Nama sudah digunakan." }, { status: 500 });
  }
}
