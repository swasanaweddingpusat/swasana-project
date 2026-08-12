import { db } from "@/lib/db";

export async function getCandidateSubmissions(recruitmentRequestId: string) {
  return db.candidateSubmission.findMany({
    where: {
      formLink: {
        recruitmentRequestId,
      },
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      address: true,
      birthPlace: true,
      birthDate: true,
      lastEducation: true,
      major: true,
      workExperienceYears: true,
      workHistory: true,
      cvUrl: true,
      photoUrl: true,
      submittedAt: true,
    },
    orderBy: { submittedAt: "desc" },
    take: 200,
  });
}

export type CandidateSubmissionItem = Awaited<ReturnType<typeof getCandidateSubmissions>>[number];
