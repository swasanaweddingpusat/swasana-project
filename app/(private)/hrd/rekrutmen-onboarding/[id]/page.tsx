import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { JobPostingDetailClient } from "./_components/JobPostingDetailClient";

export const metadata: Metadata = {
  title: "Detail Lowongan - SWASANA",
  description: "Detail lowongan dan status persetujuan",
};

export default async function JobPostingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("hr-recruitment");
  const { id } = await params;

  return (
    <div className="mb-6 flex w-full flex-col gap-6">
      <JobPostingDetailClient id={id} />
    </div>
  );
}
