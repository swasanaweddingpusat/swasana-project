import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, isSuperAdmin } from "@/lib/permissions";
import { getAllGroups, getUserGroups } from "@/lib/queries/my-team";
import { TeamGrid } from "./_components/TeamGrid";
import { Users } from "lucide-react";

export default async function MyTeamPage() {
  const session = await auth();
  if (!session?.user.profileId) redirect("/auth/login");

  const profileId = session.user.profileId;

  const isAdmin = await isSuperAdmin(session.user.roleId);
  const hasViewAll = isAdmin || (await hasPermission(session.user.roleId, "my-team", "view-all"));

  if (hasViewAll) {
    const groups = await getAllGroups();
    return <TeamGrid groups={groups} />;
  }

  const myGroups = await getUserGroups(profileId);

  if (myGroups.length === 1) {
    redirect(`/dashboard/my-team/${myGroups[0].id}`);
  }

  if (myGroups.length > 1) {
    return <TeamGrid groups={myGroups} />;
  }

  // No groups and no view-all — check for explicit permission
  const hasView = await hasPermission(session.user.roleId, "my-team", "view");
  if (!hasView) redirect("/dashboard?error=forbidden");

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
