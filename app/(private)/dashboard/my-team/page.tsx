import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMyTeamGroup, getMyTeamPerformance, getAvailableSalesProfiles } from "@/lib/queries/my-team";
import { MyTeamClient } from "./_components/my-team-client";
import { Users } from "lucide-react";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function MyTeamPage() {
  await requirePagePermission("booking");
  const session = await auth();
  if (!session?.user.profileId) redirect("/auth/login");

  const profileId = session.user.profileId;

  const group = await getMyTeamGroup(profileId);

  if (!group) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 gap-4 text-center px-4">
        <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-secondary">
          <Users className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Belum ada tim</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Anda belum tergabung dalam tim manapun. Hubungi admin untuk membuat atau bergabung ke tim.
          </p>
        </div>
      </div>
    );
  }

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [performance, availableProfiles] = await Promise.all([
    getMyTeamPerformance(group.id, { startDate, endDate }),
    getAvailableSalesProfiles(group.members.map((m) => m.userId)),
  ]);

  return (
    <div className="px-2 pb-6">
      <MyTeamClient
        group={group}
        initialPerformance={performance}
        availableProfiles={availableProfiles}
        currentProfileId={profileId}
      />
    </div>
  );
}
