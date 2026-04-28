import { Suspense } from "react";
import { getUsers } from "@/lib/queries/users";
import { getRoles } from "@/lib/queries/roles";
import { getBrands } from "@/lib/queries/venues";
import { UsersTable } from "../user-management/_components/users-table";
import { UsersLoading } from "../user-management/_components/loading";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function UsersSettingsPage() {
  await requirePagePermission("user_management");
  return (
    <div className="px-6 pb-4">
      <Suspense fallback={<UsersLoading />}>
        <UsersContent />
      </Suspense>
    </div>
  );
}

async function UsersContent() {
  const [users, roles, brands] = await Promise.all([getUsers(), getRoles(), getBrands()]);
  return <UsersTable initialData={users} roles={roles} brands={brands} />;
}
