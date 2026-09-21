import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { WorkAssignmentManager } from "@/app/(private)/hrd/manajemen-kehadiran/_components/WorkAssignmentManager";

export const metadata: Metadata = { title: "Assignment Kehadiran - SWASANA" };

export default async function AttendanceAssignmentsPage() {
  await requirePagePermission("hr-attendance");
  return <WorkAssignmentManager />;
}
