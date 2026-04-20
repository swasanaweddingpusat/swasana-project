import { getUsers } from "@/lib/queries/users";
import { getGroups } from "@/lib/queries/groups";
import { GroupsTable } from "../user-management/_components/groups-table";

export default async function GroupsSettingsPage() {
  const [users, groups] = await Promise.all([
    getUsers(),
    getGroups(),
  ]);

  return (
    <div className="px-6 py-4">
      <GroupsTable initialData={groups} users={users} />
    </div>
  );
}
