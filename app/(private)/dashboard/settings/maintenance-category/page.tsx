import { Metadata } from "next";
import { MaintenanceCategoryManager } from "./_components/MaintenanceCategoryManager";

export const metadata: Metadata = { title: "Maintenance Category" };

export default function MaintenanceCategoryPage() {
  return <MaintenanceCategoryManager />;
}
