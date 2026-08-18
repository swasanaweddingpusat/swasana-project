import { db } from "@/lib/db";

export async function getOnboardingFormLinks() {
  return db.onboardingFormLink.findMany({
    select: {
      id: true,
      name: true,
      token: true,
      accessCode: true,
      status: true,
      viewedAt: true,
      expiresAt: true,
      createdAt: true,
      creator: { select: { id: true, fullName: true } },
      submission: {
        select: {
          id: true,
          fullName: true,
          email: true,
          divisi: true,
          jabatan: true,
          submittedAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export type OnboardingFormLinkItem = Awaited<ReturnType<typeof getOnboardingFormLinks>>[number];
