import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { revalidateTag } from "next/cache";
import {
  createProcurementSchema,
  procurementFilterSchema,
} from "@/lib/validations/procurement";
import { getProcurementList } from "@/lib/queries/procurement";

// ─── GET /api/procurement ─────────────────────────────────────────────────────

export async function GET(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "procurement",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`procurement-list:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);

  const rawFilter = {
    search: searchParams.get("search") ?? undefined,
    venueId: searchParams.get("venueId") ?? undefined,
    division: searchParams.get("division") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  };

  const parsed = procurementFilterSchema.safeParse(rawFilter);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const result = await getProcurementList(parsed.data);
    return Response.json(result);
  } catch (err) {
    console.error("[PROCUREMENT] Failed to list items:", err);
    return Response.json({ error: "Gagal mengambil data pengadaan" }, { status: 500 });
  }
}

// ─── POST /api/procurement ────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "procurement",
    action: "create",
  });
  if (response) return response;
  if (!mutationLimiter.check(`create-procurement:${session.user.id}`)) return rateLimitResponse();

  const body: unknown = await req.json();
  const parsed = createProcurementSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  try {
    const [item] = await db.$transaction([
      db.procurementItem.create({
        data: {
          tanggalPermintaan: new Date(parsed.data.tanggalPermintaan),
          venueId: parsed.data.venueId,
          namaBarang: parsed.data.namaBarang,
          jumlahBarang: parsed.data.jumlahBarang,
          sisaBarang: parsed.data.sisaBarang,
          penggunaan: parsed.data.penggunaan ?? null,
          picPenerima: parsed.data.picPenerima,
          linkBarang: parsed.data.linkBarang || null,
          note: parsed.data.note ?? null,
          keterangan: parsed.data.keterangan ?? null,
          keteranganAcara: parsed.data.keteranganAcara,
          weddingNote: parsed.data.weddingNote ?? null,
          nonWeddingNote: parsed.data.nonWeddingNote ?? null,
          totalWedding: parsed.data.totalWedding ?? null,
          totalNonWedding: parsed.data.totalNonWedding ?? null,
          total: parsed.data.total ?? null,
          division: parsed.data.division ?? null,
          harga: parsed.data.harga ?? 0,
          pettyCash: parsed.data.pettyCash ?? 0,
          buktiBelUrl: parsed.data.buktiBelUrl ?? null,
          createdById: session.user.profileId,
        },
        select: { id: true, namaBarang: true, status: true, createdAt: true },
      }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "procurement.created",
      result: "success",
      entityType: "ProcurementItem",
      entityId: item.id,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });

    revalidateTag("procurement", "max");
    revalidateTag("procurement-budgets", "max");

    return Response.json(item, { status: 201 });
  } catch (err) {
    console.error("[PROCUREMENT] Failed to create item:", err);
    return Response.json({ error: "Gagal membuat data pengadaan" }, { status: 500 });
  }
}
