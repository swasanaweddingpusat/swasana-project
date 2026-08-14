// Bitrix24 CRM REST client — talks to an inbound webhook.
//
// The webhook base URL carries a static auth token and full CRM scope, so it
// is a server-only secret (BITRIX_WEBHOOK_BASE). Never import this into a
// client component. All calls are POST with a JSON body, which is what Bitrix
// expects for list methods with filter/select/order params.

const BASE = process.env.BITRIX_WEBHOOK_BASE;

export interface BitrixError {
  error: string;
  error_description?: string;
}

export class BitrixApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "BitrixApiError";
  }
}

/**
 * Low-level call to a Bitrix REST method.
 *
 * @param method dotted REST method, e.g. "crm.deal.list"
 * @param params request payload (filter/select/order/start/fields/id ...)
 * @returns the parsed `result` field of the Bitrix envelope
 * @throws BitrixApiError when the webhook is unconfigured, the HTTP call fails,
 *         or Bitrix returns an `error` envelope.
 */
export async function bitrixCall<T = unknown>(
  method: string,
  params: Record<string, unknown> = {},
): Promise<{ result: T; total?: number; next?: number }> {
  if (!BASE) {
    throw new BitrixApiError("no_config", "BITRIX_WEBHOOK_BASE is not set.");
  }

  const url = `${BASE.replace(/\/$/, "")}/${method}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      cache: "no-store",
    });
  } catch (e) {
    throw new BitrixApiError("network", `Gagal menghubungi Bitrix: ${(e as Error).message}`);
  }

  const json = (await res.json().catch(() => null)) as
    | (BitrixError & { result?: T; total?: number; next?: number })
    | null;

  if (!json) {
    throw new BitrixApiError("bad_response", `Respons Bitrix tidak valid (HTTP ${res.status}).`);
  }

  if (json.error) {
    throw new BitrixApiError(json.error, json.error_description ?? json.error);
  }

  return { result: json.result as T, total: json.total, next: json.next };
}

/**
 * Fetch a single page of a Bitrix list method (max 50 rows per call).
 *
 * Returns the rows plus paging cursors so a route handler can forward `next`
 * to the client without swallowing it.
 */
export async function bitrixList<T = Record<string, unknown>>(
  method: string,
  params: {
    filter?: Record<string, unknown>;
    select?: string[];
    order?: Record<string, "ASC" | "DESC">;
    start?: number;
  } = {},
): Promise<{ items: T[]; total: number; next?: number }> {
  const { result, total, next } = await bitrixCall<T[]>(method, {
    ...(params.filter && { filter: params.filter }),
    ...(params.select && { select: params.select }),
    ...(params.order && { order: params.order }),
    start: params.start ?? 0,
  });

  return { items: Array.isArray(result) ? result : [], total: total ?? 0, next };
}

/**
 * Fetch EVERY page of a Bitrix list method by walking the `next` cursor.
 *
 * Guarded by `maxPages` so an unexpectedly huge filter can't spin forever — the
 * overview aggregates a single day (tens of rows), so the default cap of 40
 * pages (2000 rows) is comfortably above any realistic daily volume.
 */
export async function bitrixListAll<T = Record<string, unknown>>(
  method: string,
  params: {
    filter?: Record<string, unknown>;
    select?: string[];
    order?: Record<string, "ASC" | "DESC">;
  } = {},
  maxPages = 40,
): Promise<{ items: T[]; total: number }> {
  const all: T[] = [];
  let start = 0;
  let total = 0;

  for (let page = 0; page < maxPages; page++) {
    const res = await bitrixList<T>(method, { ...params, start });
    all.push(...res.items);
    total = res.total;
    if (res.next === undefined || res.next === null) break;
    start = res.next;
  }

  return { items: all, total };
}

// ─── CRM metadata (pipelines / stages / sources) ──────────────────────────────
// These maps rarely change, so cache them in-memory with a short TTL to avoid
// re-fetching on every deals page load.

export type StageSemantic = "won" | "lost" | "process";

export interface StageCatalogItem {
  /** Stage display name, e.g. "Hot Prospek". Stable across pipelines. */
  name: string;
  /** Bitrix stage color (hex), e.g. "#faaa08". Data-driven, not a design token. */
  color: string;
  /** Won (S) / lost (F) / in-process (-) — from Bitrix SEMANTICS. */
  semantic: StageSemantic;
  /** Funnel position (0-based) used to render the segmented progress bar. */
  order: number;
}

export interface BitrixCrmMeta {
  /** CATEGORY_ID → pipeline name, e.g. "5" → "Kediaman". */
  pipelines: Record<string, string>;
  /** STATUS_ID → stage name, e.g. "C5:NEW" → "Baru" (all pipelines merged). */
  stages: Record<string, string>;
  /** STATUS_ID → stage color hex, e.g. "C5:FINAL_INVOICE" → "#faaa08". */
  stageColors: Record<string, string>;
  /** STATUS_ID → semantic, e.g. "C5:WON" → "won". */
  stageSemantics: Record<string, StageSemantic>;
  /** Ordered, de-duplicated (by name) stage funnel — for filter + progress bar. */
  stageCatalog: StageCatalogItem[];
  /** Stage name → every STATUS_ID carrying it across pipelines (for filtering). */
  stageIdsByName: Record<string, string[]>;
  /** SOURCE_ID → readable label, e.g. "29|ASKARASOFT_CONN_WA_1ENGAGE" → "...". */
  sources: Record<string, string>;
  /** Lead STATUS_ID → name, e.g. "NEW" → "Tidak ditetapkan", "JUNK" → "Prospek sampah". */
  leadStatuses: Record<string, string>;
}

let metaCache: { data: BitrixCrmMeta; expiresAt: number } | null = null;
const META_TTL_MS = 10 * 60 * 1000;

/**
 * Fetch & cache CRM metadata needed to render human-readable deal columns.
 * Uses a single Bitrix `batch` call so pipelines + sources come back in one
 * round trip; stages are fetched per pipeline (also batched).
 */
export async function getBitrixCrmMeta(): Promise<BitrixCrmMeta> {
  const now = Date.now();
  if (metaCache && now < metaCache.expiresAt) return metaCache.data;

  // Step 1 — pipelines + sources + lead statuses in one batch.
  const base = await bitrixCall("batch", {
    cmd: {
      pipelines: "crm.category.list?entityTypeId=2",
      sources: "crm.status.list?filter[ENTITY_ID]=SOURCE",
      leadStatuses: "crm.status.list?filter[ENTITY_ID]=STATUS",
    },
  });

  const batchResult = (base.result ?? {}) as unknown as {
    result?: {
      pipelines?: { categories?: { id: number; name: string }[] };
      sources?: { STATUS_ID: string; NAME: string }[];
      leadStatuses?: { STATUS_ID: string; NAME: string }[];
    };
  };

  const categories = batchResult.result?.pipelines?.categories ?? [];
  const sourceRows = batchResult.result?.sources ?? [];
  const leadStatusRows = batchResult.result?.leadStatuses ?? [];

  const pipelines: Record<string, string> = {};
  for (const c of categories) pipelines[String(c.id)] = c.name;

  const sources: Record<string, string> = {};
  for (const s of sourceRows) sources[s.STATUS_ID] = s.NAME;

  const leadStatuses: Record<string, string> = {};
  for (const s of leadStatusRows) leadStatuses[s.STATUS_ID] = s.NAME;

  // Step 2 — stages per pipeline via crm.status.list (carries COLOR + SEMANTICS,
  // which crm.dealcategory.stage.list omits). Entity id is DEAL_STAGE for the
  // default pipeline (id 0) and DEAL_STAGE_<id> for the rest.
  const stageCmd: Record<string, string> = {};
  for (const id of Object.keys(pipelines)) {
    const entity = id === "0" ? "DEAL_STAGE" : `DEAL_STAGE_${id}`;
    stageCmd[`p${id}`] = `crm.status.list?filter[ENTITY_ID]=${entity}`;
  }

  const stages: Record<string, string> = {};
  const stageColors: Record<string, string> = {};
  const stageSemantics: Record<string, StageSemantic> = {};
  const stageIdsByName: Record<string, string[]> = {};
  // Track first-seen order + representative color/semantic per stage name so the
  // funnel is de-duplicated (all pipelines share the same 12-stage sequence).
  const catalogByName = new Map<string, StageCatalogItem>();

  if (Object.keys(stageCmd).length > 0) {
    const stageBatch = await bitrixCall("batch", { cmd: stageCmd });
    const stageRes =
      ((stageBatch.result ?? {}) as {
        result?: Record<string, { STATUS_ID: string; NAME: string; COLOR?: string; SEMANTICS?: string; SORT?: number }[]>;
      }).result ?? {};

    for (const rows of Object.values(stageRes)) {
      for (const st of rows ?? []) {
        const semantic: StageSemantic = st.SEMANTICS === "S" ? "won" : st.SEMANTICS === "F" ? "lost" : "process";
        const color = (st.COLOR ?? "").toLowerCase();
        stages[st.STATUS_ID] = st.NAME;
        stageColors[st.STATUS_ID] = color;
        stageSemantics[st.STATUS_ID] = semantic;
        (stageIdsByName[st.NAME] ??= []).push(st.STATUS_ID);
        if (!catalogByName.has(st.NAME)) {
          catalogByName.set(st.NAME, { name: st.NAME, color, semantic, order: catalogByName.size });
        }
      }
    }
  }

  const stageCatalog = [...catalogByName.values()];

  const data: BitrixCrmMeta = {
    pipelines,
    stages,
    stageColors,
    stageSemantics,
    stageCatalog,
    stageIdsByName,
    sources,
    leadStatuses,
  };
  metaCache = { data, expiresAt: now + META_TTL_MS };
  return data;
}

// Cache of ALL deal enumeration fields (UF_CRM_* of type "enumeration") →
// { fieldName → { itemId → label } }. `crm.deal.fields` returns every field in
// one call, so we cache the complete map and let each caller pick the subset it
// needs. Caching only the requested subset would let one route (e.g. Transaksi,
// which asks for just ISSUE) overwrite another route's cache (Overview, which
// also needs VENUE + REASON), making labels vanish until the TTL expires.
let dealEnumCache: { data: Record<string, Record<string, string>>; expiresAt: number } | null = null;

/**
 * Fetch & cache the value maps for the given enumeration custom fields on deals.
 * Returns `{ fieldName → { itemId → label } }`; missing fields resolve to `{}`.
 *
 * The cache holds every enum field regardless of what a given call requests, so
 * the returned subset is always complete no matter the call order.
 */
export async function getBitrixDealEnums(fieldNames: string[]): Promise<Record<string, Record<string, string>>> {
  const now = Date.now();

  let all = dealEnumCache && now < dealEnumCache.expiresAt ? dealEnumCache.data : null;
  if (!all) {
    const fields = await bitrixCall<Record<string, { type?: string; items?: { ID: string; VALUE: string }[] }>>(
      "crm.deal.fields",
    );
    const defs = fields.result ?? {};

    all = {};
    for (const [name, def] of Object.entries(defs)) {
      if (!def?.items) continue;
      const map: Record<string, string> = {};
      for (const item of def.items) map[item.ID] = item.VALUE;
      all[name] = map;
    }
    dealEnumCache = { data: all, expiresAt: now + META_TTL_MS };
  }

  const out: Record<string, Record<string, string>> = {};
  for (const name of fieldNames) out[name] = all[name] ?? {};
  return out;
}

/**
 * Resolve a set of contact IDs to display names in one batched call.
 * Returns a map of id → "Name LastName" (falls back to whatever is present).
 */
export async function resolveBitrixContacts(ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};

  const out: Record<string, string> = {};
  // Bitrix caps a batch at 50 commands per call.
  for (let i = 0; i < unique.length; i += 50) {
    const slice = unique.slice(i, i + 50);
    const cmd: Record<string, string> = {};
    for (const id of slice) cmd[`c${id}`] = `crm.contact.get?id=${id}`;

    try {
      const res = await bitrixCall("batch", { cmd });
      const rows = ((res.result ?? {}) as { result?: Record<string, { ID: string; NAME?: string; LAST_NAME?: string }> }).result ?? {};
      for (const c of Object.values(rows)) {
        if (!c?.ID) continue;
        out[c.ID] = [c.NAME, c.LAST_NAME].filter(Boolean).join(" ").trim() || `#${c.ID}`;
      }
    } catch {
      // Non-fatal — leave unresolved ids to fall back to raw id on the client.
    }
  }
  return out;
}

export interface BitrixContactInfo {
  name: string;
  phone: string | null;
}

/**
 * Resolve contact IDs to name + primary phone in one batched call.
 * Phone comes from the multi-field PHONE array — first entry wins.
 */
export async function resolveBitrixContactInfo(ids: string[]): Promise<Record<string, BitrixContactInfo>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};

  const out: Record<string, BitrixContactInfo> = {};
  for (let i = 0; i < unique.length; i += 50) {
    const slice = unique.slice(i, i + 50);
    const cmd: Record<string, string> = {};
    for (const id of slice) cmd[`c${id}`] = `crm.contact.get?id=${id}`;

    try {
      const res = await bitrixCall("batch", { cmd });
      const rows = ((res.result ?? {}) as {
        result?: Record<string, { ID: string; NAME?: string; LAST_NAME?: string; PHONE?: { VALUE?: string }[] }>;
      }).result ?? {};
      for (const c of Object.values(rows)) {
        if (!c?.ID) continue;
        const name = [c.NAME, c.LAST_NAME].filter(Boolean).join(" ").trim() || `#${c.ID}`;
        const phone = Array.isArray(c.PHONE) ? c.PHONE.find((p) => p?.VALUE)?.VALUE ?? null : null;
        out[c.ID] = { name, phone };
      }
    } catch {
      // Non-fatal — leave unresolved ids to fall back to raw id on the client.
    }
  }
  return out;
}

/**
 * Resolve a set of Bitrix user IDs (ASSIGNED_BY_ID etc.) to display names in
 * one batched call. Requires the `user` scope on the webhook — degrades
 * gracefully to an empty map if that scope is missing.
 */
export async function resolveBitrixUsers(ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};

  const out: Record<string, string> = {};
  for (let i = 0; i < unique.length; i += 50) {
    const slice = unique.slice(i, i + 50);
    const cmd: Record<string, string> = {};
    for (const id of slice) cmd[`u${id}`] = `user.get?ID=${id}`;

    try {
      const res = await bitrixCall("batch", { cmd });
      const rows = ((res.result ?? {}) as { result?: Record<string, { ID: string; NAME?: string; LAST_NAME?: string }[]> }).result ?? {};
      for (const [key, arr] of Object.entries(rows)) {
        const u = Array.isArray(arr) ? arr[0] : undefined;
        if (!u?.ID) continue;
        // key is "u<id>" — strip the prefix to map back reliably.
        const id = key.startsWith("u") ? key.slice(1) : u.ID;
        out[id] = [u.NAME, u.LAST_NAME].filter(Boolean).join(" ").trim() || `#${id}`;
      }
    } catch {
      // Non-fatal — webhook may lack the `user` scope; client falls back to id.
    }
  }
  return out;
}
