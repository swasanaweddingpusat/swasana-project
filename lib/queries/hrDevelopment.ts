import { db } from "@/lib/db";

export async function getTrainingPrograms() {
  return db.trainingProgram.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      startDate: true,
      endDate: true,
      status: true,
      participantsCount: true,
      completionPercentage: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function getEmployeeDevelopments() {
  return db.employeeDevelopment.findMany({
    select: {
      id: true,
      profileId: true,
      skill: true,
      level: true,
      startDate: true,
      targetCompletionDate: true,
      progressPercentage: true,
      notes: true,
      createdAt: true,
      profile: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          employeeNumber: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function getEmployeeCertifications() {
  return db.employeeCertification.findMany({
    select: {
      id: true,
      profileId: true,
      certificationName: true,
      issueDate: true,
      expiryDate: true,
      status: true,
      notes: true,
      createdAt: true,
      profile: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          employeeNumber: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export type TrainingProgramItem = Awaited<ReturnType<typeof getTrainingPrograms>>[number];
export type EmployeeDevelopmentItem = Awaited<ReturnType<typeof getEmployeeDevelopments>>[number];
export type EmployeeCertificationItem = Awaited<ReturnType<typeof getEmployeeCertifications>>[number];
