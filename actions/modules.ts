"use server";

import { auth } from "@/lib/auth";
import { getAccessibleModules } from "@/lib/queries/modules";

/**
 * Resolve where a freshly-logged-in user should land when there is no explicit
 * callbackUrl. Picker if >=2 modules, direct if exactly 1, general home if 0.
 */
export async function resolveLoginDestination(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) return "/";

  const modules = await getAccessibleModules(session.user.roleId);
  if (modules.length >= 2) return "/select-module";
  if (modules.length === 1) return `/${modules[0].key}/overview`;
  return "/";
}
