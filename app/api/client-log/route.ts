import { z } from "zod";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";

/**
 * Client-side error sink.
 *
 * Public pages (client-agreement, wedding-indicator, …) are opened by EXTERNAL
 * people on devices we can't inspect. When their browser throws — most often a
 * `ChunkLoadError` from a stale HTML shell requesting a JS chunk a newer deploy
 * already removed (version skew) — the `(public)/error.tsx` boundary shows a
 * card but the actual error never reaches the server, so Railway logs are blind
 * to it. This endpoint receives that error and re-emits it as one structured
 * line, making the real failure greppable in Railway.
 *
 * No auth (callers are unauthenticated clients) and no DB write (pure log sink),
 * so no permission check / transaction is needed — but it IS rate-limited by IP
 * and every field is length-capped, since it's a public, unauthenticated write.
 */

const bodySchema = z.object({
  name: z.string().max(200).optional(),
  message: z.string().max(2000).optional(),
  digest: z.string().max(200).optional(),
  url: z.string().max(2000).optional(),
  userAgent: z.string().max(500).optional(),
  // Client-classified bucket so we can filter version-skew noise from real crashes.
  kind: z.enum(["chunk-load", "version-skew", "unknown"]).optional(),
});

export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!apiLimiter.check(`client-log:${ip}`)) return rateLimitResponse();

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    // Malformed payload — nothing worth logging, just reject quietly.
    return new Response(null, { status: 204 });
  }

  const entry = {
    level: parsed.kind === "unknown" || !parsed.kind ? "error" : "warn",
    source: "client",
    kind: parsed.kind ?? "unknown",
    at: new Date().toISOString(),
    name: parsed.name,
    message: parsed.message,
    digest: parsed.digest,
    url: parsed.url,
    userAgent: parsed.userAgent ?? req.headers.get("user-agent") ?? undefined,
    ip,
  };

  // Intentional observability channel — surfaced in Railway logs.
  console.error(`[clientError] ${JSON.stringify(entry)}`);

  return new Response(null, { status: 204 });
}
