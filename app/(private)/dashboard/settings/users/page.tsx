import { getUsers } from "@/lib/queries/users";
import { getRoles } from "@/lib/queries/roles";
import { getBrands } from "@/lib/queries/venues";
import { UsersTable } from "../user-management/_components/users-table";

export default async function UsersSettingsPage() {
  const [users, roles, brands] = await Promise.all([
    getUsers(),
    getRoles(),
    getBrands(),
  ]);

  return (
    <div className="px-6 py-4">
      <UsersTable initialData={users} roles={roles} brands={brands} />
    </div>
  );
}
