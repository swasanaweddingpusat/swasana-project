import { Metadata } from "next";
import { MaintenancePriorityManager } from "./_components/MaintenancePriorityManager";

export const metadata: Metadata = { title: "Maintenance Priority" };

export default function MaintenancePriorityPage() {
  return <MaintenancePriorityManager />;
}
