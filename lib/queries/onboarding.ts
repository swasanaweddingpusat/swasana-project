import { db } from "@/lib/db";

export async function getOnboardingTemplates() {
  return db.onboardingTemplate.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      isDefault: true,
      _count: { select: { tasks: true, assignments: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getOnboardingTemplateById(id: string) {
  return db.onboardingTemplate.findUnique({
    where: { id },
    include: {
      tasks: { orderBy: { sortOrder: "asc" }, take: 100 },
    },
  });
}

export async function getOnboardingAssignments(params?: { status?: string }) {
  const where: Record<string, unknown> = {};
  if (params?.status) where.status = params.status;

  return db.onboardingAssignment.findMany({
    where,
    select: {
      id: true,
      profileId: true,
      templateId: true,
      startDate: true,
      status: true,
      completedAt: true,
      profile: {
        select: {
          id: true,
          fullName: true,
          employeeNumber: true,
          avatarUrl: true,
        },
      },
      template: { select: { id: true, name: true } },
      tasks: { select: { id: true, isCompleted: true }, take: 100 },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function getMyOnboardingAssignment(profileId: string) {
  return db.onboardingAssignment.findFirst({
    where: { profileId, status: "in_progress" },
    include: {
      template: { select: { name: true } },
      tasks: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          dueDate: true,
          assignTo: true,
          isCompleted: true,
          completedAt: true,
          sortOrder: true,
          completer: { select: { fullName: true } },
        },
        take: 100,
      },
    },
  });
}

export type OnboardingTemplateItem = Awaited<ReturnType<typeof getOnboardingTemplates>>[number];
export type OnboardingTemplateDetail = Awaited<ReturnType<typeof getOnboardingTemplateById>>;
export type OnboardingAssignmentItem = Awaited<ReturnType<typeof getOnboardingAssignments>>[number];
export type MyOnboardingAssignment = Awaited<ReturnType<typeof getMyOnboardingAssignment>>;
