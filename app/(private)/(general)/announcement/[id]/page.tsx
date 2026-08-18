import type { Metadata } from "next";
import { AnnouncementDetailClient } from "./_components/AnnouncementDetailClient";

export const metadata: Metadata = { title: "Detail Announcement" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AnnouncementDetailClient announcementId={id} />;
}
