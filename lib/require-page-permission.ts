import { auth } from "@/lib/auth";
import { hasPermission, isSuperAdmin } from "@/lib/permissions";
import { redirect } from "next/navigation";

export async function requirePagePermission(module: string | string[], action: string = "view"): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  const isAdmin = await isSuperAdmin(session.user.roleId);
  if (isAdmin) return;

  const modules = Array.isArray(module) ? module : [module];
  for (const mod of modules) {
    const allowed = await hasPermission(session.user.roleId, mod, action);
    if (allowed) return;
  }
  redirect("/dashboard?error=forbidden");
}
