"use client";

import { usePathname } from "next/navigation";
import { MODULE_NAV_MAP, type ModuleKey } from "./sidebar-config";

/** The sidebar's "General" world — items that live outside any module. */
export const GENERAL_MODULE = "general" as const;
export type ActiveModule = ModuleKey | typeof GENERAL_MODULE;

function isModuleKey(key: string | null | undefined): key is ModuleKey {
  return !!key && Object.prototype.hasOwnProperty.call(MODULE_NAV_MAP, key);
}

/**
 * Resolve the sidebar's active "world" purely from the URL.
 *
 * - Inside a module (/finance/*, /hrd/*, /booking/*, /purchase/*) → that module;
 *   the sidebar shows that module's nav and hides the general items.
 * - Anywhere else (/, /settings, /cuti, /maintenance, …) → "general"; the sidebar
 *   shows Home + the general items and hides module-specific nav.
 *
 * Because the value is a pure function of the URL it survives refresh with no
 * client storage, and `usePathname()` matches on server and client so there's no
 * hydration mismatch. The module switcher navigates between worlds; the URL is
 * the single source of truth for which one is active.
 */
export function useActiveModule(): ActiveModule {
  const pathname = usePathname();
  const urlKey = pathname.split("/")[1];
  return isModuleKey(urlKey) ? urlKey : GENERAL_MODULE;
}
