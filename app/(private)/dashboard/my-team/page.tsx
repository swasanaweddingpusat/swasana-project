import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMyTeamGroup, getMyTeamPerformance, getAvailableSalesProfiles } from "@/lib/queries/my-team";
import { MyTeamClient } from "./_components/my-team-client";

export default async function MyTeamPage() {
  const session = await auth();
  if (!session?.user.profileId) redirect("/auth/login");

  const profileId = session.user.profileId;

  const group = await getMyTeamGroup(profileId);

  if (!group) {
    return (
      <div className="px-2 pb-6 flex items-center justify-center min-h-64">
        <p className="text-sm text-muted-foreground">Anda belum memiliki tim. Hubungi admin untuk membuat tim.</p>
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
