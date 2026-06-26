import type { JobPostingItem, JobPostingDetail } from "@/lib/queries/jobPostings";

export async function fetchJobPostings(): Promise<JobPostingItem[]> {
  const res = await fetch("/api/hr/job-postings");
  if (!res.ok) throw new Error("Failed to fetch job postings");
  return res.json() as Promise<JobPostingItem[]>;
}

export async function fetchJobPostingById(id: string): Promise<JobPostingDetail> {
  const res = await fetch(`/api/hr/job-postings/${id}`);
  if (!res.ok) throw new Error("Failed to fetch job posting");
  return res.json() as Promise<JobPostingDetail>;
}
