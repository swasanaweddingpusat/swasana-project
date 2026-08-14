import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { hasPermission, isSuperAdmin } from "@/lib/permissions";
import {
  getGroupDetail,
  getGroupPerformance,
  getAvailableSalesProfiles,
  getEligibleLeaders,
} from "@/lib/queries/groups";
import { logAudit } from "@/lib/audit";
import { GroupDetailClient } from "./_components/GroupDetailClient";
import type { GroupDetail } from "@/lib/queries/groups";

interface Props {
  params: Promise<{ groupId: string }>;
}

export default async function GroupDetailPage({ params }: Props) {
  const { groupId } = await params;

  await connection();
  const session = await auth();
  if (!session?.user.profileId) redirect("/auth/login");

  const profileId = session.user.profileId;
  const isAdmin = await isSuperAdmin(session.user.roleId);
  const hasViewAll = isAdmin || (await hasPermission(session.user.roleId, "groups", "view-all"));

  const group = await getGroupDetail(groupId);
  if (!group) notFound();

  const isLeader = group.leaderId === profileId;
  const isMember = group.members.some((m) => m.userId === profileId);

  if (!hasViewAll && !isLeader && !isMember) {
    const heads = await headers();
    await logAudit({
      userId: session.user.id,
      action: "groups.view_denied",
      result: "failure",
      entityType: "Group",
      entityId: groupId,
      ipAddress: heads.get("x-forwarded-for") ?? "unknown",
      userAgent: heads.get("user-agent") ?? "unknown",
    });
    redirect("/forbidden");
  }

  const canManage =
    isAdmin ||
    isLeader ||
    (await hasPermission(session.user.roleId, "groups", "edit"));

  const [performance, availableProfiles, eligibleLeaders] = await Promise.all([
    getGroupPerformance(group.id),
    canManage
      ? getAvailableSalesProfiles(group.members.map((m) => m.userId))
      : Promise.resolve([]),
    isAdmin ? getEligibleLeaders() : Promise.resolve([]),
  ]);

  return (
    <div className="pb-6 pt-1">
      <GroupDetailClient
        group={group as NonNullable<GroupDetail>}
        initialPerformance={performance}
        availableProfiles={availableProfiles}
        eligibleLeaders={eligibleLeaders}
        currentProfileId={profileId}
        canManage={canManage}
        isSuperAdmin={isAdmin}
      />
    </div>
  );
}
