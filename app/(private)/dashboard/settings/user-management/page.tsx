import { redirect } from "next/navigation";
import { requirePagePermission } from "@/lib/require-page-permission";

// Legacy URL — kept for bookmarks. Consolidated into the flat settings tabs.
export default async function UserManagementRedirect() {
  await requirePagePermission("user_management");
  redirect("/dashboard/settings/users");
}
