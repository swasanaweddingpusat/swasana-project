import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { isSuperAdmin } from "@/lib/permissions";
import type { PermissionMatrix } from "@/types/user";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!apiLimiter.check(`me-permissions:${session.user.id}`)) return rateLimitResponse();

  const roleId = session.user.roleId;
  if (!roleId) return Response.json({ isAdmin: false, permissions: {} });

  const isAdmin = await isSuperAdmin(roleId);

  if (isAdmin) {
    const allPermissions = await db.permission.findMany();
    const matrix: PermissionMatrix = {};
    for (const p of allPermissions) {
      if (!matrix[p.module]) matrix[p.module] = {};
      matrix[p.module][p.action] = true;
    }
    return Response.json({ isAdmin: true, permissions: matrix });
  }

  const rolePermissions = await db.rolePermission.findMany({
    where: { roleId },
    select: { permission: { select: { module: true, action: true } } },
  });

  const matrix: PermissionMatrix = {};
  for (const rp of rolePermissions) {
    const { module, action } = rp.permission;
    if (!matrix[module]) matrix[module] = {};
    matrix[module][action] = true;
  }

  return Response.json({ isAdmin: false, permissions: matrix });
}
