import { auth } from "@/lib/auth";
import { z } from "zod";
import { requireAnyPermissionForRoute } from "@/lib/permissions";
import { apiLimiter, mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { revalidateTag } from "next/cache";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!apiLimiter.check(`source-of-info:${session.user.id}`)) return rateLimitResponse();

  const items = await db.sourceOfInformation.findMany({
    select: { id: true, name: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return Response.json(items);
}

// ─── POST /api/source-of-informations ─────────────────────────────────────────

const createSchema = z.object({ name: z.string().min(1, "Nama wajib diisi").max(100) });

export async function POST(req: Request) {
  // Also accepts daily-activity:create — sales users add sources inline from the activity form drawer.
  const { session, response } = await requireAnyPermissionForRoute([
    { module: "settings-source-of-information", action: "create" },
    { module: "daily-activity", action: "create" },
  ]);
  if (response) return response;
  if (!mutationLimiter.check(`create-source-of-info:${session.user.id}`)) return rateLimitResponse();

  const body: unknown = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const [item] = await db.$transaction([
      db.sourceOfInformation.create({
        data: { name: parsed.data.name.trim() },
        select: { id: true, name: true, createdAt: true },
      }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "source_of_information.created",
      result: "success",
      entityType: "SourceOfInformation",
      entityId: item.id,
    });

    revalidateTag("source-of-informations", "max");

    return Response.json(item, { status: 201 });
  } catch {
    return Response.json({ error: "Nama sudah digunakan." }, { status: 500 });
  }
}
