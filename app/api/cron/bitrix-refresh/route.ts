import { timingSafeEqual } from "crypto";
import { WARM_TARGETS } from "@/lib/bitrix-warm-targets";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";

// Daily Railway Cron Job target — force-refreshes the well-known Bitrix
// queries in WARM_TARGETS so their cache entries never sit stale for more
// than ~24h even when nobody is actively reading them (see §7 of
// docs/redis-bitrix-cache-plan.md). Secret-guarded, no session involved.
interface WarmResult {
  label: string;
  ok: boolean;
  error?: string;
}

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.BITRIX_CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "Cron endpoint tidak terkonfigurasi" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  const presented = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!presented) {
    return Response.json({ error: "Akses ditolak" }, { status: 401 });
  }

  const a = Buffer.from(secret);
  const b = Buffer.from(presented);
  const secretOk = a.length === b.length && timingSafeEqual(a, b);
  if (!secretOk) {
    return Response.json({ error: "Akses ditolak" }, { status: 401 });
  }

  if (!apiLimiter.check("bitrix-cron-refresh")) {
    return rateLimitResponse();
  }

  const results: WarmResult[] = [];
  for (const target of WARM_TARGETS) {
    try {
      await target.run();
      results.push({ label: target.label, ok: true });
    } catch (e) {
      console.error(`[bitrix-cron-refresh] target "${target.label}" failed:`, (e as Error).message);
      results.push({ label: target.label, ok: false, error: (e as Error).message });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;

  return Response.json({ refreshed: okCount, failed: failCount, results });
}
