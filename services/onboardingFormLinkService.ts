import type { OnboardingFormLinkItem } from "@/lib/queries/onboardingFormLinks";

export async function fetchOnboardingFormLinks(): Promise<OnboardingFormLinkItem[]> {
  const res = await fetch("/api/hr/onboarding-form-links");
  if (!res.ok) throw new Error("Failed to fetch onboarding form links");
  return res.json() as Promise<OnboardingFormLinkItem[]>;
}
