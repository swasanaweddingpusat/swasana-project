import { db } from "@/lib/db";

export async function getPerformanceReviews() {
  return db.performanceReview.findMany({
    select: {
      id: true,
      profileId: true,
      periodStartDate: true,
      periodEndDate: true,
      rating: true,
      strengths: true,
      comments: true,
      status: true,
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

export async function getKpis() {
  return db.kpi.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      department: true,
      targetValue: true,
      achievedValue: true,
      unit: true,
      periodStartDate: true,
      periodEndDate: true,
      progressPercentage: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export type PerformanceReviewItem = Awaited<ReturnType<typeof getPerformanceReviews>>[number];
export type KpiItem = Awaited<ReturnType<typeof getKpis>>[number];
