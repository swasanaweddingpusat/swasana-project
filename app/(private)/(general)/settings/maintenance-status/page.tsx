import { Metadata } from "next";
import { MaintenanceStatusManager } from "./_components/MaintenanceStatusManager";

export const metadata: Metadata = { title: "Maintenance Status" };

export default function MaintenanceStatusPage() {
  return <MaintenanceStatusManager />;
}
