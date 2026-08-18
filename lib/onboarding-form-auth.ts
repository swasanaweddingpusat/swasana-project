import { timingSafeEqual } from "crypto";
import { db } from "@/lib/db";

export type ValidatedOnboardingFormLink = {
  id: string;
  name: string;
  status: string;
  expiresAt: Date | null;
};

export async function validateOnboardingFormToken(
  token: string,
  accessCode: string
): Promise<ValidatedOnboardingFormLink | null> {
  const link = await db.onboardingFormLink.findUnique({
    where: { token },
    select: {
      id: true,
      name: true,
      status: true,
      expiresAt: true,
      accessCode: true,
      submission: { select: { id: true } },
    },
  });

  if (!link || link.status !== "Active") return null;
  if (link.expiresAt && link.expiresAt < new Date()) return null;
  if (link.submission) return null;

  const stored = Buffer.from(link.accessCode);
  const submitted = Buffer.from(accessCode.trim().toUpperCase());
  if (stored.length !== submitted.length || !timingSafeEqual(stored, submitted)) return null;

  return {
    id: link.id,
    name: link.name,
    status: link.status,
    expiresAt: link.expiresAt,
  };
}
