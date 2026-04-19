import { headers } from "next/headers";

export async function getBaseUrl(): Promise<string> {
  // Server-side: use request headers (must await in Next.js 16)
  if (typeof window === "undefined") {
    try {
      const h = await headers();
      const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
      const protocol = h.get("x-forwarded-proto") || "http";
      return `${protocol}://${host}`;
    } catch {
      // headers() may throw outside request context (e.g. during build)
    }
  }
  // Client-side or fallback
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  return "http://localhost:3000";
}
