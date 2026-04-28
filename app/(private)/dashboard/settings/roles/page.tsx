import type { Metadata } from "next";
import { Suspense } from "react";
import { getRoles } from "@/lib/queries/roles";
import { getPermissions } from "@/lib/queries/permissions";
import { RolesManager } from "./_components/roles-manager";
import { RolesLoading } from "./_components/loading";
import { requirePagePermission } from "@/lib/require-page-permission";

export const metadata: Metadata = {
  title: "Role & Permission - SWASANA",
};

export default async function RolesSettingsPage() {
  await requirePagePermission("role_permission");
  return (
    <Suspense fallback={<RolesLoading />}>
      <RolesContent />
    </Suspense>
  );
}

async function RolesContent() {
  const [roles, permissions] = await Promise.all([getRoles(), getPermissions()]);
  return <RolesManager initialRoles={roles} initialPermissions={permissions} />;
}
