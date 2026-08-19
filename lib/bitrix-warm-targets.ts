import { bitrixList, bitrixListAll, getBitrixCrmMeta, getBitrixDealEnums } from "@/lib/bitrix";
import { DEAL_SELECT } from "@/app/api/bitrix/deals/route";
import { OVERVIEW_DEAL_SELECT } from "@/app/api/bitrix/overview/route";
import { ACTIVITY_SELECT, PROVIDER_ID } from "@/app/api/bitrix/percakapan/route";

// Well-known, high-value Bitrix queries force-refreshed once a day by the
// cron warmer (app/api/cron/bitrix-refresh/route.ts) — see §7 of
// docs/redis-bitrix-cache-plan.md. This is deliberately NOT every possible
// cache key: user-typed filter combinations are long-tail and stay purely
// read-through (lib/bitrix-cache.ts), refreshed only when actually read.
//
// Each target's params must be byte-identical (post stable-stringify) to
// what the corresponding route sends on a default, filter-less load — that's
// what makes bitrixCacheKey(method, params) hash to the SAME Redis key the
// route reads, so the warmer overwrites live traffic's cache instead of
// populating an orphan key. Hence importing the `*_SELECT` consts directly
// from the routes rather than re-typing them here.
export interface WarmTarget {
  label: string;
  run: () => Promise<unknown>;
}

// Mirrors app/api/bitrix/overview/route.ts's yesterdayFallback(null) — the
// route's default range when no `from`/`to` query params are given.
function yesterdayIsoDay(): string {
  const dt = new Date();
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

// Mirrors the `nextDay` helper duplicated in each Bitrix route file.
function nextIsoDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

export const WARM_TARGETS: WarmTarget[] = [
  {
    label: "CRM meta (pipelines/stages/sources)",
    run: () => getBitrixCrmMeta(),
  },
  {
    label: "Deal enum fields",
    // getBitrixDealEnums caches ALL enum fields behind one bitrixCall
    // regardless of the requested subset (see lib/bitrix.ts) — any non-empty
    // field list triggers the same underlying cache key.
    run: () => getBitrixDealEnums(["UF_CRM_1768930533046"]),
  },
  {
    label: "Deals list — default view",
    run: () =>
      bitrixList("crm.deal.list", {
        select: DEAL_SELECT,
        order: { DATE_CREATE: "DESC" },
        start: 0,
      }),
  },
  {
    label: "Overview — yesterday aggregate",
    run: () => {
      const fromDay = yesterdayIsoDay();
      const toDay = fromDay;
      return bitrixListAll("crm.deal.list", {
        select: OVERVIEW_DEAL_SELECT,
        filter: {
          ">=DATE_CREATE": `${fromDay}T00:00:00`,
          "<DATE_CREATE": `${nextIsoDay(toDay)}T00:00:00`,
        },
        order: { DATE_CREATE: "ASC" },
      });
    },
  },
  {
    label: "Percakapan — recent list",
    run: () =>
      bitrixList("crm.activity.list", {
        select: ACTIVITY_SELECT,
        filter: { PROVIDER_ID },
        order: { ID: "DESC" },
        start: 0,
      }),
  },
];
