import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, isSuperAdmin } from "@/lib/permissions";
import {
  getGroupDetail,
  getGroupPerformance,
  getAvailableSalesProfiles,
} from "@/lib/queries/groups";
import { GroupDetailClient } from "./_components/GroupDetailClient";
import type { GroupDetail } from "@/lib/queries/groups";

interface Props {
  params: Promise<{ groupId: string }>;
}

export default async function GroupDetailPage({ params }: Props) {
  const { groupId } = await params;

  const session = await auth();
  if (!session?.user.profileId) redirect("/auth/login");

  const profileId = session.user.profileId;
  const isAdmin = await isSuperAdmin(session.user.roleId);
  const hasViewAll = isAdmin || (await hasPermission(session.user.roleId, "groups", "view-all"));

  const group = await getGroupDetail(groupId);
  if (!group) notFound();

  const isLeader = group.leaderId === profileId;
  const isMember = group.members.some((m) => m.userId === profileId);

  if (!hasViewAll && !isLeader && !isMember) notFound();

  const canManage =
    isAdmin ||
    isLeader ||
    (await hasPermission(session.user.roleId, "groups", "edit"));

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [performance, availableProfiles] = await Promise.all([
    getGroupPerformance(group.id, startDate, endDate),
    canManage
      ? getAvailableSalesProfiles(group.members.map((m) => m.userId))
      : Promise.resolve([]),
  ]);

  return (
    <div className="px-2 pb-6">
      <GroupDetailClient
        group={group as NonNullable<GroupDetail>}
        initialPerformance={performance}
        availableProfiles={availableProfiles}
        currentProfileId={profileId}
        canManage={canManage}
        isSuperAdmin={isAdmin}
      />
    </div>
  );
}
