import type { Metadata } from "next";
import { getRoles } from "@/lib/queries/roles";
import { getPermissions } from "@/lib/queries/permissions";
import { RolesManager } from "./_components/roles-manager";
import { requirePagePermission } from "@/lib/require-page-permission";

export const metadata: Metadata = {
  title: "Role & Permission - SWASANA",
};

export default async function RolesSettingsPage() {
  await requirePagePermission("role_permission");
  const [roles, permissions] = await Promise.all([
    getRoles(),
    getPermissions(),
  ]);

  return <RolesManager initialRoles={roles} initialPermissions={permissions} />;
}
