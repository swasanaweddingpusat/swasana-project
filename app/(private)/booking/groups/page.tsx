import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, isSuperAdmin } from "@/lib/permissions";
import { getGroupsWithPerformance, getEligibleLeaders } from "@/lib/queries/groups";
import { GroupsClient } from "./_components/GroupsClient";

export default async function GroupsPage() {
  await connection();
  const session = await auth();
  if (!session?.user.profileId) redirect("/auth/login");

  const profileId = session.user.profileId;
  const isAdmin = await isSuperAdmin(session.user.roleId);
  const isViewAll =
    isAdmin || (await hasPermission(session.user.roleId, "groups", "view-all"));

  const hasView = isViewAll || (await hasPermission(session.user.roleId, "groups", "view"));
  if (!hasView) redirect("/forbidden");

  const groups = await getGroupsWithPerformance(
    isViewAll ? undefined : profileId,
  );

  const canCreate = isAdmin || (await hasPermission(session.user.roleId, "groups", "create"));
  const canEdit = isAdmin || (await hasPermission(session.user.roleId, "groups", "edit"));
  const canDelete = isAdmin || (await hasPermission(session.user.roleId, "groups", "delete"));

  const eligibleLeaders = isAdmin ? await getEligibleLeaders() : [];

  return (
    // TODO(page-bg): dashboard/layout.tsx uses hardcoded bg-gray-100 on the outer shell.
    // Adding a warm amber tint here would clash with that. Rely on card gradients for warmth.
    <div className="px-2 pb-6">
      <GroupsClient
        initialGroups={groups}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        eligibleLeaders={eligibleLeaders}
      />
    </div>
  );
}
