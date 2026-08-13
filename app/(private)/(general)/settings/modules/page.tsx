import type { Metadata } from "next";
import { getAllModules, getPermissionModules } from "@/lib/queries/modules";
import { requirePagePermission } from "@/lib/require-page-permission";
import { ModulesManager } from "./_components/modules-manager";

export const metadata: Metadata = {
  title: "Modules - SWASANA",
};

export default async function ModulesSettingsPage() {
  await requirePagePermission("settings-role-permission");
  const [modules, permissionModules] = await Promise.all([
    getAllModules(),
    getPermissionModules(),
  ]);
  return (
    <ModulesManager initialModules={modules} permissionModules={permissionModules} />
  );
}
