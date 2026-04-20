import { getUsers } from "@/lib/queries/users";
import { getGroups } from "@/lib/queries/groups";
import { GroupManagement } from "./_components/group-management";

export default async function GroupsSettingsPage() {
  const [users, groups] = await Promise.all([
    getUsers(),
    getGroups(),
  ]);

  return <GroupManagement initialGroups={groups} users={users} />;
}
