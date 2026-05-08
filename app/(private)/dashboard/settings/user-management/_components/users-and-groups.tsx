"use client";

import { useState } from "react";
import { UsersTable } from "./users-table";
import { GroupManagement } from "../../groups/_components/group-management";
import type { UsersQueryResult } from "@/lib/queries/users";
import type { RolesQueryResult } from "@/lib/queries/roles";
import type { GroupsQueryResult } from "@/lib/queries/groups";
import { cn } from "@/lib/utils";

interface UsersAndGroupsProps {
  users: UsersQueryResult;
  roles: RolesQueryResult;
  groups: GroupsQueryResult;
}

const tabs = [
  { id: "users", label: "Users" },
  { id: "groups", label: "Groups" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function UsersAndGroups({ users, roles, groups }: UsersAndGroupsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("users");

  return (
    <div className="w-full">
      <div className={cn("flex", "border-b", "border-border", "mb-4")}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === "users" && (
        <UsersTable initialData={users} roles={roles} />
      )}
      {activeTab === "groups" && (
        <GroupManagement initialGroups={groups} users={users} />
      )}
    </div>
  );
}
