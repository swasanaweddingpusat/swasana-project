import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, isSuperAdmin } from "@/lib/permissions";
import {
  getGroupDetail,
  getGroupPerformance,
  getAvailableSalesProfiles,
  getEligibleLeaders,
} from "@/lib/queries/groups";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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

  const [performance, availableProfiles, eligibleLeaders] = await Promise.all([
    getGroupPerformance(group.id),
    canManage
      ? getAvailableSalesProfiles(group.members.map((m) => m.userId))
      : Promise.resolve([]),
    isAdmin ? getEligibleLeaders() : Promise.resolve([]),
  ]);

  return (
    // TODO(page-bg): dashboard/layout.tsx uses hardcoded bg-gray-100 on the outer shell.
    // Adding a warm amber tint here would clash with that. Rely on card gradients for warmth.
    <div className="px-2 pb-6">
      <div className="px-4 pt-4 pb-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href="/dashboard/groups" />}>
                Groups
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{group.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
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
