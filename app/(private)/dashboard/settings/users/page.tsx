import { getUsers } from "@/lib/queries/users";
import { getRoles } from "@/lib/queries/roles";
import { getBrands } from "@/lib/queries/venues";
import { UsersTable } from "../user-management/_components/users-table";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function UsersSettingsPage() {
  await requirePagePermission("user_management");
  const [users, roles, brands] = await Promise.all([
    getUsers(),
    getRoles(),
    getBrands(),
  ]);

  return (
    <div className="px-6 pb-4">
      <UsersTable initialData={users} roles={roles} brands={brands} />
    </div>
  );
}
