import { getRoles } from "@/lib/queries/roles";
import { getPermissions } from "@/lib/queries/permissions";
import { RolesManager } from "./_components/roles-manager";

export default async function RolesPage() {
  const [roles, permissions] = await Promise.all([getRoles(), getPermissions()]);
  return <RolesManager initialRoles={roles} initialPermissions={permissions} />;
}
