import type { CandidateSubmissionItem } from "@/lib/queries/candidateSubmissions";

export async function fetchCandidateSubmissions(
  recruitmentRequestId: string
): Promise<CandidateSubmissionItem[]> {
  const res = await fetch(
    `/api/hr/recruitment-requests/${encodeURIComponent(recruitmentRequestId)}/submissions`
  );
  if (!res.ok) throw new Error("Failed to fetch candidate submissions");
  return res.json() as Promise<CandidateSubmissionItem[]>;
}
