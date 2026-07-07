"use client";

import Image from "next/image";

export function OfflineContent() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
      <Image
        src="/logo-swasana.png"
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
