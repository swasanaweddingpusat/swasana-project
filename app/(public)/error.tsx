"use client";

import * as React from "react";
import { DangerTriangle, Refresh, Copy, CheckCircle } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Error boundary for all PUBLIC pages (client-agreement, wedding-indicator, auth).
 *
 * These are opened by EXTERNAL people (clients signing a PO, couples filling a
 * questionnaire) — so it must NOT link back to /dashboard (they have no access),
 * and it must self-heal the most common failure: a stale HTML shell requesting a
 * JS chunk that a newer deploy already removed (ChunkLoadError). That surfaces as
 * a hard crash on devices whose browser cached the old page. We reload ONCE to
 * fetch the fresh shell; a guard prevents an infinite reload loop if the error is
 * something else.
 *
 * The hard part is IN-APP BROWSERS (WhatsApp/Instagram/Line webviews). They cache
 * aggressively, often BLOCK sessionStorage, and re-serve `location.reload()` from
 * their own cache instead of hitting the network. So the self-heal here:
 *   1. Uses a URL query flag as the reload guard when sessionStorage is blocked.
 *   2. Cache-busts the reload URL so even a stubborn webview must refetch.
 *   3. Purges any service-worker + Cache Storage entries first (staff may have
 *      logged in on this device, registering the SW at scope "/").
 * When all that still isn't enough, we detect the in-app browser and surface a
 * real "open in Chrome/Safari" affordance instead of a dead-end message.
 */

const RELOAD_GUARD_KEY = "public-error-chunk-reload";
const RELOAD_GUARD_PARAM = "_cberr";

function isChunkLoadError(error: (Error & { digest?: string }) | undefined): boolean {
  if (!error) return false;
  const name = error.name ?? "";
  const msg = error.message ?? "";
  return (
    name === "ChunkLoadError" ||
    /Loading chunk .+ failed/i.test(msg) ||
    /Loading CSS chunk/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /importing a module script failed/i.test(msg)
  );
}

/** Best-effort detection of embedded webviews (chat apps' in-app browsers). */
function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent ?? "";
  return /FBAN|FBAV|Instagram|Line\/|WhatsApp|MicroMessenger|Snapchat|Twitter|TikTok|GSA/i.test(ua);
}

/** Reload guard that survives sessionStorage being blocked (uses a URL flag). */
function reloadGuard() {
  let url: URL | null = null;
  try {
    url = new URL(window.location.href);
  } catch {
    url = null;
  }

  const readSession = (): boolean => {
    try {
      return sessionStorage.getItem(RELOAD_GUARD_KEY) === "1";
    } catch {
      return false;
    }
  };
  const urlHasFlag = url?.searchParams.get(RELOAD_GUARD_PARAM) === "1";

  return {
    alreadyReloaded: readSession() || urlHasFlag,
    /** Mark that we're about to reload, in BOTH stores we can reach. */
    markAndReload() {
      try {
        sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
      } catch {
        /* blocked — URL flag below is the fallback */
      }
      const target = url ?? new URL(window.location.href);
      target.searchParams.set(RELOAD_GUARD_PARAM, "1");
      // Cache-bust so a webview can't re-serve the stale shell for this exact URL.
      target.searchParams.set("_cb", String(performance.now()).replace(".", ""));
      window.location.replace(target.toString());
    },
  };
}

/** Drop any SW registration + Cache Storage so the next load is fully fresh. */
async function purgeCaches(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    /* noop */
  }
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* noop */
  }
}

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = React.useState(false);
  const [inApp, setInApp] = React.useState(false);

  React.useEffect(() => {
    setInApp(isInAppBrowser());
  }, []);

  // Auto-reload once on a chunk error — the cached shell is stale, a fresh GET
  // pulls the current chunks. The guard (sessionStorage OR a URL flag) makes this
  // fire at most once so a genuinely broken page doesn't reload forever.
  React.useEffect(() => {
    if (!isChunkLoadError(error)) return;
    const guard = reloadGuard();
    if (guard.alreadyReloaded) return;
    void purgeCaches().then(() => guard.markAndReload());
  }, [error]);

  // Clear the sessionStorage guard once a page renders successfully again, so the
  // next unrelated chunk error can still auto-reload. The URL flag clears itself
  // by virtue of the user navigating to a clean link.
  React.useEffect(() => {
    return () => {
      try {
        sessionStorage.removeItem(RELOAD_GUARD_KEY);
      } catch {
        /* noop */
      }
    };
  }, []);

  async function hardReload() {
    try {
      sessionStorage.removeItem(RELOAD_GUARD_KEY);
    } catch {
      /* noop */
    }
    await purgeCaches();
    // Strip our guard/cache-bust params so this reload starts from a clean URL.
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete(RELOAD_GUARD_PARAM);
      url.searchParams.delete("_cb");
      url.searchParams.set("_cb", String(performance.now()).replace(".", ""));
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  }

  async function copyLink() {
    // Copy the CLEAN link (no guard/cache-bust params) so the user can paste it
    // into a real browser and get a pristine load.
    let clean = window.location.href;
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete(RELOAD_GUARD_PARAM);
      url.searchParams.delete("_cb");
      clean = url.toString();
    } catch {
      /* use raw href */
    }
    try {
      await navigator.clipboard.writeText(clean);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API blocked (insecure context / webview) — fall back to a prompt
      // the user can long-press to copy from.
      window.prompt("Salin tautan ini, lalu buka di Chrome / Safari:", clean);
    }
  }

  return (
    <div className={cn("flex min-h-svh flex-col items-center justify-center bg-gray-50 px-4 text-center")}>
      <div className={cn("w-full max-w-sm rounded-2xl border bg-white p-8 shadow-sm")}>
        <DangerTriangle
          weight="BoldDuotone"
          className="mx-auto mb-4 h-14 w-14"
          style={{ color: "var(--brand-gold)" }}
        />
        <h1 className="text-lg font-semibold text-foreground">Halaman gagal dimuat</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sepertinya ada versi halaman yang tersimpan di perangkat Anda. Muat ulang
          halaman untuk memuat versi terbaru.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={hardReload} className="w-full rounded-full">
            <Refresh weight="BoldDuotone" className="mr-2 h-4 w-4" />
            Muat Ulang Halaman
          </Button>
          <Button variant="outline" onClick={() => reset()} className="w-full rounded-full">
            Coba Lagi
          </Button>
        </div>

        {/* In-app browsers (WhatsApp/IG/Line) are the devices that get stuck here —
            give them a real way out instead of only the text hint below. */}
        {inApp ? (
          <div className="mt-4 rounded-xl border border-dashed bg-gray-50 p-3">
            <p className="text-xs text-muted-foreground">
              Anda membuka ini di dalam aplikasi chat. Agar lancar, buka di Chrome
              atau Safari.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={copyLink}
              className="mt-3 w-full rounded-full"
            >
              {copied ? (
                <>
                  <CheckCircle weight="BoldDuotone" className="mr-2 h-4 w-4" />
                  Tautan Disalin
                </>
              ) : (
                <>
                  <Copy weight="BoldDuotone" className="mr-2 h-4 w-4" />
                  Salin Tautan
                </>
              )}
            </Button>
          </div>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">
            Jika masih bermasalah, buka tautan ini di peramban (Chrome / Safari),
            bukan di aplikasi chat.
          </p>
        )}
      </div>
    </div>
  );
}
