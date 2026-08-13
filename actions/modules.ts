"use server";

import { auth } from "@/lib/auth";
import { getAccessibleModules } from "@/lib/queries/modules";
import { apiLimiter } from "@/lib/rate-limit";

/**
 * Resolve where a freshly-logged-in user should land when there is no explicit
 * callbackUrl. Picker if >=2 modules, direct if exactly 1, general home if 0.
 */
export async function resolveLoginDestination(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) return "/";

  // Rate-limit before any DB work. On limit, fall back to the picker (a safe
  // authenticated landing) rather than resolving a per-role destination.
  if (!apiLimiter.check(`resolve-dest:${session.user.id}`)) return "/select-module";

  const modules = await getAccessibleModules(session.user.roleId);
  if (modules.length >= 2) return "/select-module";
  if (modules.length === 1) return `/${modules[0].key}/overview`;
  return "/";
}
