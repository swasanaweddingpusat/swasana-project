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
    select: { isSystemRole: true },
  });
  return role?.isSystemRole === true;
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

/**
 * Route guard that passes when the user satisfies ANY of the given checks.
 * Use for shared reference endpoints (e.g. event types) consumed across
 * multiple features — a user with leads OR booking OR quotations access
 * should all be able to read them.
 */
export async function requireAnyPermissionForRoute(
  checks: PermissionCheck[]
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

  if (await isSuperAdmin(session.user.roleId)) {
    return { session, response: null };
  }

  for (const check of checks) {
    if (await hasPermission(session.user.roleId, check.module, check.action)) {
      return { session, response: null };
    }
  }

  return {
    session: null,
    response: Response.json({ error: "Forbidden" }, { status: 403 }),
  };
}
