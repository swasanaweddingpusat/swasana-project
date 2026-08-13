"use server";

import { auth } from "@/lib/auth";
import { getAccessibleModules, type AccessibleModule } from "@/lib/queries/modules";
import { apiLimiter } from "@/lib/rate-limit";

/**
 * Result of resolving where a freshly-logged-in user should go.
 * - `redirect`: land straight on `dest` (0 or 1 accessible module, or rate-limited).
 * - `choose`: the user can access >=2 modules — the login form shows an inline
 *   picker modal with these `modules` instead of navigating anywhere.
 */
export type LoginDestination =
  | { kind: "redirect"; dest: string }
  | { kind: "choose"; modules: AccessibleModule[] };

/**
 * Resolve where a freshly-logged-in user should land when there is no explicit
 * callbackUrl. Inline picker if >=2 modules, direct redirect if exactly 1,
 * general home if 0.
 */
export async function resolveLoginDestination(): Promise<LoginDestination> {
  const session = await auth();
  if (!session?.user?.id) return { kind: "redirect", dest: "/" };

  // Rate-limit before any DB work. On limit, fall back to the standalone picker
  // page (a safe authenticated landing) rather than resolving a per-role dest.
  if (!apiLimiter.check(`resolve-dest:${session.user.id}`)) {
    return { kind: "redirect", dest: "/select-module" };
  }

  const modules = await getAccessibleModules(session.user.roleId);
  if (modules.length >= 2) return { kind: "choose", modules };
  if (modules.length === 1) return { kind: "redirect", dest: `/${modules[0].key}/overview` };
  return { kind: "redirect", dest: "/" };
}
