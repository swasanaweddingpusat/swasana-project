import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { bitrixList, BitrixApiError } from "@/lib/bitrix";

interface RawContact {
  ID: string;
  NAME?: string;
  LAST_NAME?: string;
}

/**
 * GET /api/bitrix/contacts?q=<name>
 *
 * Contact name typeahead — used to resolve a client name typed in a filter
 * into a precise CONTACT_ID. Bitrix has no full-name filter, so this runs two
 * single-page queries (one on NAME, one on LAST_NAME) and merges the results
 * by id. Typeahead only: an empty `q` returns an empty list rather than
 * listing every contact in the portal.
 */
export async function GET(request: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({ module: "bitrix", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`bitrix-contacts:${session.user.id}`)) return rateLimitResponse();

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  try {
    if (!q) return Response.json([]);

    const [byName, byLastName] = await Promise.all([
      bitrixList<RawContact>("crm.contact.list", {
        select: ["ID", "NAME", "LAST_NAME"],
        filter: { "%NAME": q },
      }),
      bitrixList<RawContact>("crm.contact.list", {
        select: ["ID", "NAME", "LAST_NAME"],
        filter: { "%LAST_NAME": q },
      }),
    ]);

    const merged = new Map<string, RawContact>();
    for (const c of [...byName.items, ...byLastName.items]) merged.set(c.ID, c);

    const rows = [...merged.values()]
      .map((c) => ({
        id: c.ID,
        name: [c.NAME, c.LAST_NAME].filter(Boolean).join(" ").trim() || `#${c.ID}`,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "id"))
      .slice(0, 50);

    return Response.json(rows);
  } catch (e) {
    if (e instanceof BitrixApiError) {
      const status = e.code === "no_config" ? 503 : 502;
      return Response.json({ error: e.message, code: e.code }, { status });
    }
    console.error("[api/bitrix/contacts]", e);
    return Response.json({ error: "Gagal mengambil daftar kontak Bitrix." }, { status: 500 });
  }
}
