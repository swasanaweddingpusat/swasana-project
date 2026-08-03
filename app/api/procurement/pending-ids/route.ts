import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function GET(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "procurement",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`procurement-pending-ids:${session.user.id}`))
    return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? undefined;
  const venueId = searchParams.get("venueId") ?? undefined;
  const division = searchParams.get("division") ?? undefined;
  const dateFrom = searchParams.get("dateFrom") ?? undefined;
  const dateTo = searchParams.get("dateTo") ?? undefined;

  const where: Prisma.ProcurementItemWhereInput = {
    status: "PENDING",
    ...(search && {
      OR: [
        { namaBarang: { contains: search, mode: "insensitive" as const } },
        { picPenerima: { contains: search, mode: "insensitive" as const } },
      ],
    }),
    ...(venueId && { venueId }),
    ...(division && { division: division as "HR" | "OPERATIONAL" | "IT" | "FINANCE" | "MICE" }),
    ...((dateFrom || dateTo) && {
      tanggalPermintaan: {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo) }),
      },
    }),
  };

  try {
    const items = await db.procurementItem.findMany({
      where,
      select: { id: true },
    });
    return Response.json({ ids: items.map((i) => i.id) });
  } catch (err) {
    console.error("[PROCUREMENT] Failed to fetch pending IDs:", err);
    return Response.json({ error: "Gagal mengambil ID pengajuan" }, { status: 500 });
  }
}
