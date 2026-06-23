import type {
  OnboardingTemplateItem,
  OnboardingAssignmentItem,
  MyOnboardingAssignment,
} from "@/lib/queries/onboarding";

export async function fetchOnboardingTemplates(): Promise<OnboardingTemplateItem[]> {
  const res = await fetch("/api/hr/onboarding-templates");
  if (!res.ok) throw new Error("Failed to fetch onboarding templates");
  return res.json() as Promise<OnboardingTemplateItem[]>;
}

export async function fetchOnboardingAssignments(params?: {
  status?: string;
}): Promise<OnboardingAssignmentItem[]> {
  const sp = new URLSearchParams();
  if (params?.status) sp.set("status", params.status);
  const res = await fetch(`/api/hr/onboarding-assignments?${sp.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch onboarding assignments");
  return res.json() as Promise<OnboardingAssignmentItem[]>;
}

export async function fetchMyOnboarding(): Promise<MyOnboardingAssignment | null> {
  const res = await fetch("/api/hr/onboarding-assignments/my");
  if (!res.ok) throw new Error("Failed to fetch my onboarding");
  return res.json() as Promise<MyOnboardingAssignment | null>;
}
