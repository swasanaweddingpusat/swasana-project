import { Metadata } from "next";
import { LeadSegmentManager } from "./_components/lead-segment-manager";

export const metadata: Metadata = { title: "Lead Segment" };

export default function LeadSegmentPage() {
  return <LeadSegmentManager />;
}
