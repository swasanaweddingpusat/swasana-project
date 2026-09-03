import { db } from "@/lib/db";

export async function getCandidates(params?: { jobPostingId?: string; stage?: string }) {
  const where: Record<string, unknown> = {};
  if (params?.jobPostingId) where.jobPostingId = params.jobPostingId;
  if (params?.stage) where.stage = params.stage;

  return db.candidate.findMany({
    where,
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      stage: true,
      rating: true,
      resumeUrl: true,
      coverLetterUrl: true,
      notes: true,
      rejectionReason: true,
      expectedSalary: true,
      viewed: true,
      hiredAt: true,
      hiredProfileId: true,
      createdAt: true,
      jobPostingId: true,
      jobPosting: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

export async function getCandidateById(id: string) {
  return db.candidate.findUnique({
    where: { id },
    include: {
      jobPosting: {
        select: {
          id: true,
          title: true,
          departmentId: true,
          positionId: true,
          employmentType: true,
        },
      },
      hiredProfile: { select: { id: true, fullName: true } },
      candidateNotes: {
        select: {
          id: true,
          content: true,
          createdAt: true,
          creator: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });
}

export type CandidateItem = Awaited<ReturnType<typeof getCandidates>>[number];
export type CandidateDetail = Awaited<ReturnType<typeof getCandidateById>>;
