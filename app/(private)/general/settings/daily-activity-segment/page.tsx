import { Metadata } from "next";
import { DailyActivitySegmentManager } from "./_components/daily-activity-segment-manager";

export const metadata: Metadata = { title: "Segment Activity" };

export default function DailyActivitySegmentPage() {
  return <DailyActivitySegmentManager />;
}
