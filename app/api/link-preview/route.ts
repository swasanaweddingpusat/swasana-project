import { z } from "zod";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";

const urlSchema = z.string().url();

function extractMeta(html: string, ...names: string[]): string | null {
  for (const name of names) {
    const m =
      html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`, "i")) ??
      html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`, "i"));
    if (m?.[1]) return m[1];
  }
  return null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1]?.trim() ?? null;
}

export async function GET(req: Request): Promise<Response> {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!apiLimiter.check(`link-preview:${ip}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("url") ?? "";

  const parsed = urlSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "invalid url" }, { status: 400 });
  }
  const url = parsed.data;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LinkPreviewBot/1.0)" },
    });
    if (!res.ok) return Response.json({ error: "fetch failed" });

    const html = await res.text();

    const title = extractMeta(html, "og:title", "twitter:title") ?? extractTitle(html);
    const description = extractMeta(html, "og:description", "twitter:description", "description");
    const image = extractMeta(html, "og:image", "twitter:image");
    const ogUrl = extractMeta(html, "og:url") ?? url;

    return new Response(JSON.stringify({ title, description, image, url: ogUrl }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return Response.json({ error: "failed" });
  }
}
