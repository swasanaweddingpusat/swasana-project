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
  try {
    const [users, groups] = await Promise.all([getUsers(), getGroups()]);
    return <GroupManagement initialGroups={groups} users={users} />;
  } catch (e) {
    console.error("[GroupsContent] Failed to load data:", e);
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-sm">Gagal memuat data. Silakan refresh halaman.</p>
      </div>
    );
  }
}
