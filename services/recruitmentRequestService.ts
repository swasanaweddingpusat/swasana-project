import type { RecruitmentRequestItem } from "@/lib/queries/recruitmentRequests";

export async function fetchRecruitmentRequests(): Promise<RecruitmentRequestItem[]> {
  const res = await fetch("/api/hr/recruitment-requests");
  if (!res.ok) throw new Error("Failed to fetch recruitment requests");
  return res.json() as Promise<RecruitmentRequestItem[]>;
}
