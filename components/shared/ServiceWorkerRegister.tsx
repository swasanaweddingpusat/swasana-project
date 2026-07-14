"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Dev: JANGAN daftarkan SW. Turbopack meng-hash ulang chunk /_next/static/
    // tiap HMR, sedangkan SW cache-first menyajikan chunk lama → mismatch
    // "module factory is not available". Bersihkan SW + cache lama supaya dev
    // tidak lagi disajikan artefak basi.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => { void reg.unregister(); });
      });
      if ("caches" in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => { void caches.delete(key); });
        });
      }
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "activated" &&
              navigator.serviceWorker.controller
            ) {
              toast.info("Versi baru tersedia", {
                description: "Refresh halaman untuk mendapatkan pembaruan.",
                action: {
                  label: "Refresh",
                  onClick: () => window.location.reload(),
                },
                duration: 10000,
              });
            }
          });
        });
      })
      .catch((err) => {
        console.error("SW registration failed:", err);
      });
  }, []);

  return null;
}
