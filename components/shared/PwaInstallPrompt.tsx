"use client";

import { useState, useEffect, useCallback } from "react";
import { CloseCircle } from "@solar-icons/react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const SNOOZE_KEY = "pwa-install-snooze-until"; // timestamp (ms) sampai kapan banner ditahan
const VISIT_KEY = "pwa-visit-count";
const DAY = 1000 * 60 * 60 * 24;

// Cooldown per jenis interaksi — makin sengaja nolaknya, makin lama ditahan.
const SHOWN_COOLDOWN = 3 * DAY;    // begitu tampil, jangan nag lagi minimal 3 hari
const DISMISS_COOLDOWN = 14 * DAY; // klik ✕ → tahan 14 hari
const INSTALLED_COOLDOWN = 365 * DAY; // udah install → praktis stop

function snooze(ms: number): void {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + ms));
  } catch {
    /* localStorage unavailable — noop */
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Banner install hanya untuk mobile — desktop tidak menampilkannya.
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    // Sudah terpasang sebagai PWA → jangan pernah tampilkan.
    if (isStandalone()) return;

    try {
      const snoozeUntil = Number(localStorage.getItem(SNOOZE_KEY) || "0");
      if (Date.now() < snoozeUntil) return;

      const visits = Number(localStorage.getItem(VISIT_KEY) || "0") + 1;
      localStorage.setItem(VISIT_KEY, String(visits));
      if (visits < 2) return;
    } catch {
      // localStorage unavailable (private browsing) — skip
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
      // Tampil sekali ini saja untuk beberapa hari, walau user hanya mengabaikannya.
      snooze(SHOWN_COOLDOWN);
    };
    const onInstalled = () => {
      snooze(INSTALLED_COOLDOWN);
      setVisible(false);
      setDeferredPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    // Batal di popup native pun tetap ditahan (pakai cooldown "tampil"),
    // jadi tidak balik lagi di navigasi berikutnya.
    if (outcome === "accepted") snooze(INSTALLED_COOLDOWN);
    setVisible(false);
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    snooze(DISMISS_COOLDOWN);
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 mx-auto max-w-md animate-in slide-in-from-bottom-4 md:bottom-6">
      <div className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-lg">
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">
            Install Swasana
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Akses lebih cepat langsung dari home screen
          </p>
        </div>
        <button
          type="button"
          onClick={handleInstall}
          className="shrink-0 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Install
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent"
          aria-label="Tutup"
        >
          <CloseCircle weight="BoldDuotone" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
