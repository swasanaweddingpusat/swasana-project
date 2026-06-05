import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { revalidateTag } from "next/cache";
import { getMaintenanceCategories } from "@/lib/queries/maintenance";
import { createMaintenanceCategorySchema } from "@/lib/validations/maintenance";

// ─── GET /api/maintenance-categories ─────────────────────────────────────────

export async function GET(_req: Request) {
  const { session, response } = await requirePermissionForRoute({
    module: "maintenance",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`maintenance-categories:${session.user.id}`)) return rateLimitResponse();

  try {
    const categories = await getMaintenanceCategories();
    return Response.json(categories);
  } catch {
    return Response.json({ error: "Gagal mengambil kategori maintenance" }, { status: 500 });
  }
}

// ─── POST /api/maintenance-categories ────────────────────────────────────────

export async function POST(req: Request) {
  const { session, response } = await requirePermissionForRoute({
    module: "settings-maintenance-category",
    action: "create",
  });
  if (response) return response;
  if (!mutationLimiter.check(`create-maintenance-category:${session.user.id}`)) return rateLimitResponse();

  const body: unknown = await req.json();
  const parsed = createMaintenanceCategorySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const [category] = await db.$transaction([
      db.maintenanceCategory.create({
        data: { name: parsed.data.name },
        select: { id: true, name: true, createdAt: true },
      }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "maintenance_category.created",
      result: "success",
      entityType: "MaintenanceCategory",
      entityId: category.id,
    });

    revalidateTag("maintenance-categories", "max");

    return Response.json(category, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal membuat kategori." }, { status: 500 });
  }
}
