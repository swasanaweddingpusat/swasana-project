import { Suspense } from "react";
import { connection } from "next/server";
import { getUsers } from "@/lib/queries/users";
import { getRoles } from "@/lib/queries/roles";
import { getBrands } from "@/lib/queries/venues";
import { getGroups } from "@/lib/queries/groups";
import { UsersAndGroups } from "../user-management/_components/users-and-groups";
import { UsersLoading } from "../user-management/_components/loading";
import { requirePagePermission } from "@/lib/require-page-permission";
import { cn } from "@/lib/utils";

export default async function UsersSettingsPage() {
  await requirePagePermission("settings-users");
  return (
    <div className={cn('px-6', 'pb-4')}>
      <Suspense fallback={<UsersLoading />}>
        <UsersContent />
      </Suspense>
    </div>
  );
}

async function UsersContent() {
  await connection();
  const [users, roles, brands, groups] = await Promise.all([
    getUsers(),
    getRoles(),
    getBrands(),
    getGroups(),
  ]);
  return <UsersAndGroups users={users} roles={roles} brands={brands} groups={groups} />;
}
