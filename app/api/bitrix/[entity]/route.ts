import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { bitrixList, BitrixApiError } from "@/lib/bitrix";

// Whitelist of CRM entities we expose, mapped to their Bitrix list method.
// Keeps the proxy from being a free pass to call any REST method.
// Note: `deals` has a dedicated enriched route at /api/bitrix/deals (static
// segments win over this [entity] param), so it's intentionally not listed here.
const ENTITY_METHOD: Record<string, string> = {
  leads: "crm.lead.list",
  contacts: "crm.contact.list",
  companies: "crm.company.list",
  activities: "crm.activity.list",
};

/**
 * GET /api/bitrix/[entity]?select=ID,TITLE&filter[STAGE_ID]=WON&order[DATE_CREATE]=DESC&start=0
 *
 * Read-only proxy over Bitrix24 CRM list methods. One page (max 50 rows) per
 * call — forward `next` back to the client to page through.
 *
 * Query params:
 *   - select:  comma-separated field names (optional; Bitrix defaults apply)
 *   - order[FIELD]=ASC|DESC   (repeatable)
 *   - filter[FIELD]=value     (repeatable; prefix FIELD with >,<,>=,<=,!,% per Bitrix)
 *   - start:   pagination offset (multiple of 50)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ entity: string }> },
) {
  const { entity } = await params;
  const method = ENTITY_METHOD[entity];
  if (!method) {
    return Response.json(
      { error: `Entity tidak dikenal. Pilihan: ${Object.keys(ENTITY_METHOD).join(", ")}` },
      { status: 400 },
    );
  }

  const { session, response } = await requirePermissionForRoute({ module: "customers", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`bitrix:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(request.url);

  // select — comma-separated
  const rawSelect = searchParams.get("select");
  const select = rawSelect ? rawSelect.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

  // filter[FIELD]=value → { FIELD: value }
  const filter: Record<string, string> = {};
  const order: Record<string, "ASC" | "DESC"> = {};
  for (const [key, value] of searchParams.entries()) {
    const fMatch = key.match(/^filter\[(.+)\]$/);
    if (fMatch) {
      filter[fMatch[1]] = value;
      continue;
    }
    const oMatch = key.match(/^order\[(.+)\]$/);
    if (oMatch) {
      order[oMatch[1]] = value.toUpperCase() === "ASC" ? "ASC" : "DESC";
    }
  }

  const startRaw = Number(searchParams.get("start"));
  const start = Number.isFinite(startRaw) && startRaw >= 0 ? startRaw : 0;

  try {
    const { items, total, next } = await bitrixList(method, {
      ...(select && { select }),
      ...(Object.keys(filter).length > 0 && { filter }),
      ...(Object.keys(order).length > 0 && { order }),
      start,
    });
    return Response.json({ items, total, next: next ?? null });
  } catch (e) {
    if (e instanceof BitrixApiError) {
      const status = e.code === "no_config" ? 503 : 502;
      return Response.json({ error: e.message, code: e.code }, { status });
    }
    console.error("[api/bitrix]", e);
    return Response.json({ error: "Gagal mengambil data Bitrix." }, { status: 500 });
  }
}
