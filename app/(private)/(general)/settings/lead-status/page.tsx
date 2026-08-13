import { Metadata } from "next";
import { LeadStatusManager } from "./_components/lead-status-manager";

export const metadata: Metadata = { title: "Lead Status" };

export default function LeadStatusPage() {
  return <LeadStatusManager />;
}
