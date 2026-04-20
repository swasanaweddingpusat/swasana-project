import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Session } from "next-auth";

// ─── Types ────────────────────────────────────────────────────────────────────

type PermissionCheck = {
  module: string;
  action: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export async function isSuperAdmin(roleId: string | null | undefined): Promise<boolean> {
  if (!roleId) return false;
  const role = await db.role.findUnique({
    where: { id: roleId },
    select: { name: true },
  });
  return role?.name.toLowerCase() === "super admin";
}

export async function hasPermission(
  roleId: string | null | undefined,
  module: string,
  action: string
): Promise<boolean> {
  if (!roleId) return false;
  if (await isSuperAdmin(roleId)) return true;

  const rp = await db.rolePermission.findFirst({
    where: {
      roleId,
      permission: { module, action },
    },
  });
  return !!rp;
}

// ─── For server actions — returns session or error string ─────────────────────

export async function requirePermission(
  check: PermissionCheck
): Promise<
  | { session: Session; error: null }
  | { session: null; error: string }
> {
  const session = await auth();

  if (!session?.user?.id) {
    return { session: null, error: "Sesi tidak ditemukan. Silakan login kembali." };
  }

  const allowed = await hasPermission(session.user.roleId, check.module, check.action);
  if (!allowed) {
    return { session: null, error: "Anda tidak memiliki izin untuk melakukan tindakan ini." };
  }

  return { session, error: null };
}

// ─── For route handlers — returns Response or session ────────────────────────

export async function requirePermissionForRoute(
  check: PermissionCheck
): Promise<
  | { session: Session; response: null }
  | { session: null; response: Response }
> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      session: null,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const allowed = await hasPermission(session.user.roleId, check.module, check.action);
  if (!allowed) {
    return {
      session: null,
      response: Response.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { session, response: null };
}
