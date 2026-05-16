import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, isSuperAdmin } from "@/lib/permissions";
import { getGroupDetail, getMyTeamPerformance, getAvailableSalesProfiles } from "@/lib/queries/my-team";
import { MyTeamClient } from "./_components/my-team-client";
import type { MyTeamGroup } from "@/lib/queries/my-team";

interface Props {
  params: Promise<{ groupId: string }>;
}

export default async function MyTeamDetailPage({ params }: Props) {
  const { groupId } = await params;

  const session = await auth();
  if (!session?.user.profileId) redirect("/auth/login");

  const profileId = session.user.profileId;

  const isAdmin = await isSuperAdmin(session.user.roleId);
  const hasViewAll = isAdmin || await hasPermission(session.user.roleId, "my-team", "view-all");

  const group = await getGroupDetail(groupId);
  if (!group) notFound();

  const isLeader = group.leaderId === profileId;
  const isMember = group.members.some((m) => m.userId === profileId);

  if (!hasViewAll && !isLeader && !isMember) notFound();

  const canManage = isLeader;

  const [performance, availableProfiles] = await Promise.all([
    getMyTeamPerformance(group.id),
    canManage ? getAvailableSalesProfiles(group.members.map((m) => m.userId)) : Promise.resolve([]),
  ]);

  return (
    <div className="px-2 pb-6">
      <MyTeamClient
        group={group as NonNullable<MyTeamGroup>}
        initialPerformance={performance}
        availableProfiles={availableProfiles}
        currentProfileId={profileId}
        canManage={canManage}
      />
    </div>
  );
}
