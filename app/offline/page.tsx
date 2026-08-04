import { OfflineContent } from "./_components/OfflineContent";

// No dynamic data access here, so under `cacheComponents` this route is
// prerendered statically by default — safe for the service worker to precache.
// (Do NOT add `export const dynamic` — it's removed in Next.js 16 when
// cacheComponents is enabled.)
export const metadata = {
  title: "Offline — Swasana",
};

export default function OfflinePage() {
  return <OfflineContent />;
}
