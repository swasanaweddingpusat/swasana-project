import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

export async function getRoles() {
  "use cache";
  cacheTag("roles");
  cacheLife("hours");

  return db.role.findMany({
    include: {
      rolePermissions: {
        include: {
          permission: {
            select: {
              id: true,
              module: true,
              action: true,
              description: true,
            },
          },
        },
      },
      _count: {
        select: {
          profiles: true,
        },
      },
    },
    orderBy: { sortOrder: "asc" },
  });
}

export type RolesQueryResult = Awaited<ReturnType<typeof getRoles>>;
export type RoleQueryItem = RolesQueryResult[number];
