import { Metadata } from "next";
import { MaintenancePage } from "./_components/MaintenanceTabs";

export const metadata: Metadata = { title: "Maintenance" };

export default function Page() {
  return <MaintenancePage />;
}
