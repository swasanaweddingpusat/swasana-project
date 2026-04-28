import { Suspense } from "react";
import { getUsers } from "@/lib/queries/users";
import { getGroups } from "@/lib/queries/groups";
import { GroupManagement } from "./_components/group-management";
import { GroupsLoading } from "./_components/loading";

export default function GroupsSettingsPage() {
  return (
    <Suspense fallback={<GroupsLoading />}>
      <GroupsContent />
    </Suspense>
  );
}

async function GroupsContent() {
  const [users, groups] = await Promise.all([getUsers(), getGroups()]);
  return <GroupManagement initialGroups={groups} users={users} />;
}
