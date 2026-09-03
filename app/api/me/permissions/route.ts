import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import type { PermissionMatrix } from "@/types/user";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!apiLimiter.check(`me-permissions:${session.user.id}`)) return rateLimitResponse();

  const roleId = session.user.roleId;
  const profileId = session.user.profileId;

  const isAdmin = session.user.isSuperAdmin ?? false;

  // Check if user is leader or member of any group
  const isGroupMember = profileId
    ? !!(await db.userGroup.findFirst({
        where: {
          OR: [
            { leaderId: profileId },
            { members: { some: { userId: profileId } } },
          ],
        },
        select: { id: true },
      }))
    : false;

  if (!roleId) return Response.json({ isAdmin: false, isGroupMember, permissions: {} });

  if (isAdmin) {
    // Cap at 500 — permissions table is bounded (one row per module+action tuple).
    // If total exceeds 500, the system has > 50 modules × 10 actions which is
    // far beyond current scope. Raise the cap if that ever changes.
    const allPermissions = await db.permission.findMany({ take: 500 });
    const matrix: PermissionMatrix = {};
    for (const p of allPermissions) {
      if (!matrix[p.module]) matrix[p.module] = {};
      matrix[p.module][p.action] = true;
    }
    return Response.json({ isAdmin: true, isGroupMember, permissions: matrix });
  }

  const rolePermissions = await db.rolePermission.findMany({
    where: { roleId },
    select: { permission: { select: { module: true, action: true } } },
  });

  const matrix: PermissionMatrix = {};
  for (const rp of rolePermissions) {
    // Skip orphan grants whose permission row was deleted (dangling FK → null).
    if (!rp.permission) continue;
    const { module, action } = rp.permission;
    if (!matrix[module]) matrix[module] = {};
    matrix[module][action] = true;
  }

  return Response.json({ isAdmin: false, isGroupMember, permissions: matrix });
}
