import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { bitrixListAll, BitrixApiError } from "@/lib/bitrix";

interface RawUser {
  ID: string;
  NAME?: string;
  LAST_NAME?: string;
}

/**
 * GET /api/bitrix/sales
 *
 * Returns the Bitrix users that can be responsible for a conversation (active
 * employees), as { id, name }. Used by the Percakapan filter dropdown. Bitrix
 * user ids differ from the app's own user ids — RESPONSIBLE_ID on an activity
 * points into this Bitrix user namespace.
 */
export async function GET() {
  const { session, response } = await requirePermissionForRoute({ module: "bitrix", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`bitrix-sales:${session.user.id}`)) return rateLimitResponse();

  try {
    const { items } = await bitrixListAll<RawUser>("user.get", {
      filter: { USER_TYPE: "employee", ACTIVE: true },
      select: ["ID", "NAME", "LAST_NAME"],
      order: { ID: "ASC" },
    });

    const rows = items
      .map((u) => ({
        id: u.ID,
        name: [u.NAME, u.LAST_NAME].filter(Boolean).join(" ").trim() || `#${u.ID}`,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "id"));

    return Response.json(rows);
  } catch (e) {
    if (e instanceof BitrixApiError) {
      const status = e.code === "no_config" ? 503 : 502;
      return Response.json({ error: e.message, code: e.code }, { status });
    }
    console.error("[api/bitrix/sales]", e);
    return Response.json({ error: "Gagal mengambil daftar sales Bitrix." }, { status: 500 });
  }
}
