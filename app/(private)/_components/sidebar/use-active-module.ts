"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { MODULE_NAV_MAP, type ModuleKey } from "./sidebar-config";

/** localStorage key that remembers which module "world" is active. */
const STORAGE_KEY = "swasana:active-module";

/** Fallback world when nothing has been persisted yet and the URL is a general
 *  route — booking is the app's landing world. */
const DEFAULT_MODULE: ModuleKey = "booking";

function isModuleKey(key: string | null | undefined): key is ModuleKey {
  return !!key && Object.prototype.hasOwnProperty.call(MODULE_NAV_MAP, key);
}

// ── localStorage-backed external store (read during render, no setState) ──
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function readStoredModule(): ModuleKey | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isModuleKey(stored) ? stored : null;
  } catch {
    return null;
  }
}

function writeStoredModule(module: ModuleKey): void {
  try {
    localStorage.setItem(STORAGE_KEY, module);
  } catch {
    /* storage unavailable — fall back to URL-derived value */
  }
  for (const l of listeners) l();
}

/**
 * Resolve the sidebar's active module — persisted in localStorage so that
 * navigating to a cross-module "General" route (/cuti, /slip-gaji, /settings, …)
 * does NOT swap the sidebar out of whatever module the user was in.
 *
 * Rules:
 * - URL inside a real module (/finance/*, /hrd/*, /booking/*, /purchase/*)
 *   → that module becomes active and is written to localStorage.
 * - URL on a general route → the active module is left untouched (read back
 *   from localStorage), so the module's nav stays on screen.
 *
 * Server render (and the client's first paint) uses a deterministic value (URL
 * module or DEFAULT_MODULE); the store is read via useSyncExternalStore so the
 * persisted world is reflected without a setState-in-effect cascade.
 */
export function useActiveModule(): ModuleKey {
  const pathname = usePathname();
  const urlKey = pathname.split("/")[1];
  const urlModule = isModuleKey(urlKey) ? urlKey : null;

  // Read persisted module during render. SSR + first client snapshot return null
  // (deterministic markup); after hydration the real stored value is used.
  const stored = useSyncExternalStore(subscribe, readStoredModule, () => null);

  // A real module route wins and is persisted; a general route falls back to the
  // stored world so the sidebar stays put.
  const active: ModuleKey = urlModule ?? stored ?? DEFAULT_MODULE;

  // Persisting is a write to an external system — the correct use of an effect.
  useEffect(() => {
    if (urlModule && urlModule !== stored) writeStoredModule(urlModule);
  }, [urlModule, stored]);

  return active;
}
