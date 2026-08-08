import { requireAnyPermissionForRoute, requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getEventTypes } from "@/lib/queries/event-types";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { z } from "zod";

export async function GET(req: Request) {
  // Event types are shared reference data — readable by anyone who works with
  // bookings, MICE bookings, leads, or quotations.
  const { session, response } = await requireAnyPermissionForRoute([
    { module: "booking", action: "view" },
    { module: "booking-mice", action: "view" },
    { module: "daily-activity", action: "view" },
    { module: "quotations", action: "view" },
  ]);
  if (response) return response;
  if (!apiLimiter.check(`event-types:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const categoryParam = searchParams.get("category");
  const category =
    categoryParam === "WEDDINGS" || categoryParam === "MICE"
      ? categoryParam
      : undefined;

  try {
    const eventTypes = await getEventTypes(category);
    return Response.json(eventTypes);
  } catch {
    return Response.json({ error: "Gagal mengambil event types" }, { status: 500 });
  }
}

const createEventTypeSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.enum(["WEDDINGS", "MICE"]).default("MICE"),
});

export async function POST(req: Request) {
  const { session, response } = await requirePermissionForRoute({
    module: "settings-event-types",
    action: "create",
  });
  if (response) return response;
  if (!mutationLimiter.check(`event-type-create:${session.user.id}`)) return rateLimitResponse();

  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = createEventTypeSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Data tidak valid" }, { status: 422 });

  const { name, category } = parsed.data;

  // Generate a unique code from name initials
  const baseCode = name
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 8) || "ET";

  // Ensure code uniqueness
  let code = baseCode;
  let suffix = 1;
  while (await db.eventType.findUnique({ where: { code } })) {
    code = `${baseCode}${suffix}`;
    suffix++;
  }

  try {
    const maxOrder = await db.eventType.findFirst({
      where: { category },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const eventType = await db.eventType.create({
      data: { name, code, category, sortOrder: (maxOrder?.sortOrder ?? 0) + 1 },
      select: { id: true, name: true, code: true, category: true, sortOrder: true, isActive: true, createdAt: true },
    });
    revalidateTag("event-types", "max");
    return Response.json(eventType, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal membuat event type" }, { status: 500 });
  }
}
