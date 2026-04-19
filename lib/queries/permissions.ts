import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

export async function getPermissions() {
  "use cache";
  cacheTag("permissions");
  cacheLife("hours");

  return db.permission.findMany({
    orderBy: [{ module: "asc" }, { action: "asc" }],
  });
}

export type PermissionsQueryResult = Awaited<ReturnType<typeof getPermissions>>;
export type PermissionQueryItem = PermissionsQueryResult[number];
