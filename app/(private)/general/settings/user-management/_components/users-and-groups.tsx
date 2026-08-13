import { UsersTable } from "./users-table";
import type { UsersQueryResult } from "@/lib/queries/users";
import type { RolesQueryResult } from "@/lib/queries/roles";

interface UsersAndGroupsProps {
  users: UsersQueryResult;
  roles: RolesQueryResult;
}

export function UsersAndGroups({ users, roles }: UsersAndGroupsProps) {
  return <UsersTable initialData={users} roles={roles} />;
}
