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

/**
 * Server-action guard: passes when user satisfies ANY of the given checks.
 * Use for actions reachable from multiple feature contexts (e.g. createCashIn
 * callable dari booking drawer ATAU AR finance).
 */
export async function requireAnyPermission(
  checks: PermissionCheck[]
): Promise<
  | { session: Session; error: null }
  | { session: null; error: string }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { session: null, error: "Sesi tidak ditemukan. Silakan login kembali." };
  }
  if (await isSuperAdmin(session.user.roleId)) {
    return { session, error: null };
  }
  for (const check of checks) {
    if (await hasPermission(session.user.roleId, check.module, check.action)) {
      return { session, error: null };
    }
  }
  return { session: null, error: "Anda tidak memiliki izin untuk melakukan tindakan ini." };
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
 * Scope guard for salesId-filtered booking queries in the groups panel.
 *
 * Returns true when the caller is allowed to see bookings of a specific sales
 * profile (salesId = a Profile.id).
 *
 * Allowed when:
 *   1. Super admin (isSystemRole)
 *   2. Has groups:view-all permission
 *   3. The salesId belongs to a group where the caller (myProfileId) is also
 *      a leader or member — they share group membership.
 *
 * Param signature mirrors what the route handler already has: roleId and
 * profileId come from session.user, isSuperAdmin is cached in the JWT.
 */
export async function canViewSalesBookings(
  myProfileId: string,
  roleId: string | null | undefined,
  salesId: string,
): Promise<boolean> {
  // 1. Super admin bypasses everything
  if (await isSuperAdmin(roleId)) return true;

  // 2. Explicit groups:view-all permission
  if (await hasPermission(roleId, "groups", "view-all")) return true;

  // 3. Share at least one group with the salesId target
  //    Find all groups where caller is leader OR member
  const myGroups = await db.userGroup.findMany({
    where: {
      OR: [
        { leaderId: myProfileId },
        { members: { some: { userId: myProfileId } } },
      ],
    },
    select: {
      leaderId: true,
      members: { select: { userId: true } },
    },
  });

  if (myGroups.length === 0) return false;

  // Collect all profile IDs reachable through those groups
  const reachableIds = new Set<string>();
  for (const g of myGroups) {
    if (g.leaderId) reachableIds.add(g.leaderId);
    for (const m of g.members) reachableIds.add(m.userId);
  }

  return reachableIds.has(salesId);
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
