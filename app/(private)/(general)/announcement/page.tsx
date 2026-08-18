import type { Metadata } from "next";
import { AnnouncementClient } from "./_components/AnnouncementClient";

export const metadata: Metadata = { title: "Announcement" };

export default function Page() {
  return <AnnouncementClient />;
}
