import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { getManagerGroups } from "@/lib/queries/dailyReportManager";
import { DailyReportManagerClient } from "./_components/DailyReportManagerClient";

export default async function DailyReportManagerPage() {
  await connection();
  const session = await auth();
  if (!session?.user?.profileId) redirect("/auth/login");

  const { profileId, roleId, isSuperAdmin } = session.user;

  const hasView =
    isSuperAdmin || (await hasPermission(roleId, "daily-report-manager", "view"));
  if (!hasView) redirect("/");

  const canCreate =
    isSuperAdmin ||
    (await hasPermission(roleId, "daily-report-manager", "create"));
  const canEdit =
    isSuperAdmin ||
    (await hasPermission(roleId, "daily-report-manager", "edit"));
  const canDelete =
    isSuperAdmin ||
    (await hasPermission(roleId, "daily-report-manager", "delete"));

  const isViewAllGroups =
    isSuperAdmin || (await hasPermission(roleId, "groups", "view-all"));

  const groups = isViewAllGroups
    ? await db.userGroup.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : await getManagerGroups(profileId);

  return (
    <div className="px-2 pb-6">
      <DailyReportManagerClient
        groups={groups}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    </div>
  );
}
