import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { revalidateTag } from "next/cache";
import { updateProcurementSchema } from "@/lib/validations/procurement";
import { getProcurementById } from "@/lib/queries/procurement";

// ─── GET /api/procurement/[id] ────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  const { session, response } = await requirePermissionForRoute({
    module: "procurement",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`procurement-detail:${session.user.id}`)) return rateLimitResponse();

  try {
    const item = await getProcurementById(id);
    if (!item) {
      return Response.json({ error: "Data pengadaan tidak ditemukan." }, { status: 404 });
    }
    return Response.json(item);
  } catch (err) {
    console.error("[PROCUREMENT] Failed to get item by id:", err);
    return Response.json({ error: "Gagal mengambil data pengadaan" }, { status: 500 });
  }
}

// ─── PATCH /api/procurement/[id] ─────────────────────────────────────────────

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  const { session, response } = await requirePermissionForRoute({
    module: "procurement",
    action: "edit",
  });
  if (response) return response;
  if (!mutationLimiter.check(`patch-procurement:${session.user.id}`)) return rateLimitResponse();

  const existing = await db.procurementItem.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return Response.json({ error: "Data pengadaan tidak ditemukan." }, { status: 404 });
  }

  const body: unknown = await req.json();
  const parsed = updateProcurementSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  try {
    const [updated] = await db.$transaction([
      db.procurementItem.update({
        where: { id },
        data: {
          ...(parsed.data.tanggalPermintaan !== undefined && {
            tanggalPermintaan: new Date(parsed.data.tanggalPermintaan),
          }),
          ...(parsed.data.venueId !== undefined && { venueId: parsed.data.venueId }),
          ...(parsed.data.namaBarang !== undefined && { namaBarang: parsed.data.namaBarang }),
          ...(parsed.data.jumlahBarang !== undefined && { jumlahBarang: parsed.data.jumlahBarang }),
          ...(parsed.data.sisaBarang !== undefined && { sisaBarang: parsed.data.sisaBarang }),
          ...(parsed.data.penggunaan !== undefined && {
            penggunaan: parsed.data.penggunaan ?? null,
          }),
          ...(parsed.data.picPenerima !== undefined && { picPenerima: parsed.data.picPenerima }),
          ...(parsed.data.linkBarang !== undefined && {
            linkBarang: parsed.data.linkBarang || null,
          }),
          ...(parsed.data.note !== undefined && { note: parsed.data.note ?? null }),
          ...(parsed.data.keterangan !== undefined && {
            keterangan: parsed.data.keterangan ?? null,
          }),
          ...(parsed.data.keteranganAcara !== undefined && {
            keteranganAcara: parsed.data.keteranganAcara,
          }),
          ...(parsed.data.weddingNote !== undefined && {
            weddingNote: parsed.data.weddingNote ?? null,
          }),
          ...(parsed.data.nonWeddingNote !== undefined && {
            nonWeddingNote: parsed.data.nonWeddingNote ?? null,
          }),
          ...(parsed.data.totalWedding !== undefined && {
            totalWedding: parsed.data.totalWedding ?? null,
          }),
          ...(parsed.data.totalNonWedding !== undefined && {
            totalNonWedding: parsed.data.totalNonWedding ?? null,
          }),
          ...(parsed.data.total !== undefined && { total: parsed.data.total ?? null }),
          ...(parsed.data.division !== undefined && { division: parsed.data.division ?? null }),
          ...(parsed.data.harga !== undefined && { harga: parsed.data.harga }),
          ...(parsed.data.pettyCash !== undefined && { pettyCash: parsed.data.pettyCash }),
          ...(parsed.data.buktiBelUrl !== undefined && {
            buktiBelUrl: parsed.data.buktiBelUrl ?? null,
          }),
        },
        select: { id: true, namaBarang: true, status: true, updatedAt: true },
      }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "procurement.updated",
      result: "success",
      entityType: "ProcurementItem",
      entityId: id,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });

    revalidateTag("procurement", "max");
    revalidateTag("procurement-budgets", "max");

    return Response.json(updated);
  } catch (err) {
    console.error("[PROCUREMENT] Failed to update item:", err);
    return Response.json({ error: "Gagal mengupdate data pengadaan." }, { status: 500 });
  }
}

// ─── DELETE /api/procurement/[id] ────────────────────────────────────────────

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  const { session, response } = await requirePermissionForRoute({
    module: "procurement",
    action: "delete",
  });
  if (response) return response;
  if (!mutationLimiter.check(`delete-procurement:${session.user.id}`)) return rateLimitResponse();

  const existing = await db.procurementItem.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return Response.json({ error: "Data pengadaan tidak ditemukan." }, { status: 404 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  try {
    await db.$transaction([db.procurementItem.delete({ where: { id } })]);

    await logAudit({
      userId: session.user.id,
      action: "procurement.deleted",
      result: "success",
      entityType: "ProcurementItem",
      entityId: id,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });

    revalidateTag("procurement", "max");
    revalidateTag("procurement-budgets", "max");

    return Response.json({ success: true });
  } catch (err) {
    console.error("[PROCUREMENT] Failed to delete item:", err);
    return Response.json({ error: "Gagal menghapus data pengadaan." }, { status: 500 });
  }
}
