import { redirect } from "next/navigation";

// Legacy URL — kept for bookmarks. Consolidated into the flat settings tabs.
export default function UserManagementRedirect() {
  redirect("/dashboard/settings/users");
}
