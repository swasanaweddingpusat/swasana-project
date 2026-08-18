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
          nickName: true,
          email: true,
          phoneNumber: true,
          divisi: true,
          jabatan: true,
          venueId: true,
          joinDate: true,
          placeOfBirth: true,
          dateOfBirth: true,
          maritalStatus: true,
          ktpAddress: true,
          currentAddress: true,
          motherName: true,
          numberOfChildren: true,
          lastEducation: true,
          emergencyContactName: true,
          emergencyContactRel: true,
          emergencyContactPhone: true,
          bankName: true,
          bankAccountNumber: true,
          ktpFileUrl: true,
          kkFileUrl: true,
          photoUrl: true,
          submittedAt: true,
          venue: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export type OnboardingFormLinkItem = Awaited<ReturnType<typeof getOnboardingFormLinks>>[number];
