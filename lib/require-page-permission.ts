import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";

export async function requirePagePermission(module: string | string[], action: string = "view"): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  if (session.user.isSuperAdmin) return;

  const modules = Array.isArray(module) ? module : [module];
  for (const mod of modules) {
    // knownIsSuperAdmin=false: already ruled out above, skip the redundant re-check.
    const allowed = await hasPermission(session.user.roleId, mod, action, false);
    if (allowed) return;
  }
  redirect("/forbidden");
}
