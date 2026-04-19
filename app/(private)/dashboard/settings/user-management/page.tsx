import { getUsers } from "@/lib/queries/users";
import { getRoles } from "@/lib/queries/roles";
import { getVenues } from "@/lib/queries/venues";
import { UsersTable } from "./_components/users-table";

export default async function UserManagementPage() {
  const [users, roles, venues] = await Promise.all([
    getUsers(),
    getRoles(),
    getVenues(),
  ]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">User Management</h1>
        <p className="text-muted-foreground text-sm">
          Kelola pengguna, undang anggota baru, dan atur akses venue.
        </p>
      </div>
      <UsersTable initialData={users} roles={roles} venues={venues} />
    </div>
  );
}
