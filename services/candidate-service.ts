import type { CandidateItem } from "@/lib/queries/candidates";

export async function fetchCandidates(params?: {
  jobPostingId?: string;
  stage?: string;
}): Promise<CandidateItem[]> {
  const sp = new URLSearchParams();
  if (params?.jobPostingId) sp.set("jobPostingId", params.jobPostingId);
  if (params?.stage) sp.set("stage", params.stage);
  const res = await fetch(`/api/hr/candidates?${sp.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch candidates");
  return res.json() as Promise<CandidateItem[]>;
}
