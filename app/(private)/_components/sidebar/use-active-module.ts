"use client";

import { useEffect, useState } from "react";
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
 * First render uses a deterministic value (URL module or DEFAULT_MODULE) to keep
 * server and client markup identical; the effect then reconciles with storage.
 */
export function useActiveModule(): ModuleKey {
  const pathname = usePathname();
  const urlKey = pathname.split("/")[1];
  const urlModule = isModuleKey(urlKey) ? urlKey : null;

  const [active, setActive] = useState<ModuleKey>(urlModule ?? DEFAULT_MODULE);

  useEffect(() => {
    if (urlModule) {
      setActive(urlModule);
      try {
        localStorage.setItem(STORAGE_KEY, urlModule);
      } catch {
        /* storage unavailable — fall back to in-memory state */
      }
    } else {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (isModuleKey(stored)) setActive(stored);
      } catch {
        /* storage unavailable — keep current state */
      }
    }
  }, [urlModule]);

  return active;
}
