"use client";

import * as React from "react";
import { DangerTriangle, Refresh } from "@solar-icons/react";
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
 * fetch the fresh shell; a sessionStorage guard prevents an infinite reload loop
 * if the error is something else.
 */

const RELOAD_GUARD_KEY = "public-error-chunk-reload";

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

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Auto-reload once on a chunk error — the cached shell is stale, a fresh GET
  // pulls the current chunks. The guard makes this fire at most once per session
  // so a genuinely broken page doesn't reload forever.
  React.useEffect(() => {
    if (!isChunkLoadError(error)) return;
    let alreadyTried = false;
    try {
      alreadyTried = sessionStorage.getItem(RELOAD_GUARD_KEY) === "1";
      if (!alreadyTried) sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
    } catch {
      // sessionStorage unavailable (private mode / blocked) — skip auto-reload,
      // the manual "Muat Ulang" button below still works.
      return;
    }
    if (!alreadyTried) window.location.reload();
  }, [error]);

  // Clear the guard once a page renders successfully again — handled here on
  // unmount so the next unrelated chunk error can still auto-reload.
  React.useEffect(() => {
    return () => {
      try {
        sessionStorage.removeItem(RELOAD_GUARD_KEY);
      } catch {
        /* noop */
      }
    };
  }, []);

  function hardReload() {
    try {
      sessionStorage.removeItem(RELOAD_GUARD_KEY);
    } catch {
      /* noop */
    }
    window.location.reload();
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
        <p className="mt-4 text-xs text-muted-foreground">
          Jika masih bermasalah, buka tautan ini di peramban (Chrome / Safari),
          bukan di aplikasi chat.
        </p>
      </div>
    </div>
  );
}
