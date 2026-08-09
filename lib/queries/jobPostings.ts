import { db } from "@/lib/db";

export async function getJobPostings() {
  return db.jobPosting.findMany({
    select: {
      id: true,
      title: true,
      status: true,
      employmentType: true,
      location: true,
      salaryRangeMin: true,
      salaryRangeMax: true,
      openDate: true,
      closeDate: true,
      createdAt: true,
      department: { select: { id: true, name: true } },
      position: { select: { id: true, name: true } },
      _count: { select: { candidates: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function getJobPostingById(id: string) {
  return db.jobPosting.findUnique({
    where: { id },
    include: {
      department: { select: { id: true, name: true } },
      position: { select: { id: true, name: true } },
      brand: { select: { id: true, name: true } },
      approver: { select: { id: true, fullName: true } },
      creator: { select: { id: true, fullName: true } },
      candidates: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          stage: true,
          rating: true,
          resumeUrl: true,
          createdAt: true,
          hiredAt: true,
          rejectionReason: true,
          _count: { select: { candidateNotes: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export type JobPostingItem = Awaited<ReturnType<typeof getJobPostings>>[number];
export type JobPostingDetail = Awaited<ReturnType<typeof getJobPostingById>>;
