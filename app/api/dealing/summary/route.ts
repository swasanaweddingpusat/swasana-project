import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { getDealingSummary } from "@/lib/queries/bookings";
import type { DataScope } from "@/types/user";

// True for a bare ISO calendar day ("2026-08-31").
function isIsoDay(v: string | null): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/**
 * GET /api/dealing/summary?from=2026-08-01&to=2026-08-31
 *
 * Ringkasan "Jumlah Dealing" untuk card di Bitrix Overview: booking Confirmed
 * (recordStatus saved) yang dibuat (createdAt = tanggal dealing) dalam rentang,
 * total + per-sales. Data Postgres (Booking), atribusi per-Profile — beda dari
 * metrik database Bitrix di halaman yang sama. Di-scope ke dataScope pemanggil:
 * super-admin melihat semua, selain itu own/group sesuai Profile.dataScope.
 */
export async function GET(request: Request) {
  const { session, response } = await requirePermissionForRoute({ module: "bitrix", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`dealing-summary:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(request.url);
  const fromRaw = searchParams.get("from");
  const toRaw = searchParams.get("to");
  if (!isIsoDay(fromRaw)) {
    return Response.json({ error: "Parameter 'from' wajib format YYYY-MM-DD." }, { status: 400 });
  }
  const toDay = isIsoDay(toRaw) ? toRaw : fromRaw;
  const from = new Date(`${fromRaw}T00:00:00`);
  const to = new Date(`${toDay}T23:59:59.999`);

  const profileId = session.user.profileId;
  const isAdmin = session.user.isSuperAdmin;

  // Super-admin: no scope filter (undefined → all). Others: scope by their
  // Profile.dataScope (own/group), defaulting to the safest "own".
  let dataScope: DataScope | undefined;
  let scopeProfileId: string | undefined;
  if (!isAdmin && profileId) {
    const profile = await db.profile.findUnique({ where: { id: profileId }, select: { dataScope: true } });
    dataScope = (profile?.dataScope as DataScope) ?? "own";
    scopeProfileId = profileId;
  }

  try {
    const summary = await getDealingSummary(scopeProfileId, dataScope, from, to);
    return Response.json(summary);
  } catch (e) {
    console.error("[api/dealing/summary]", e);
    return Response.json({ error: "Gagal memuat ringkasan dealing." }, { status: 500 });
  }
}
