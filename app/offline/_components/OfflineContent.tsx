"use client";

export function OfflineContent() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
      {/* Plain <img>, NOT next/image: the optimizer rewrites the src to
          /_next/image?url=... which the service worker hasn't precached, so the
          logo would fail to load on the very page meant to work offline. This
          points straight at the raw asset the SW precaches. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/swasana-logo.png"
        alt="Swasana"
        width={80}
        height={80}
        className="mb-6 opacity-60"
      />
      <h1 className="text-xl font-heading font-semibold text-foreground">
        Anda sedang offline
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Periksa koneksi internet Anda dan coba lagi.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-6 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Coba Lagi
      </button>
    </div>
  );
}
