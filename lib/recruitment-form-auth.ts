import { timingSafeEqual } from "crypto";
import { db } from "@/lib/db";

export type ValidatedFormLink = {
  id: string;
  status: string;
  expiresAt: Date | null;
  recruitmentRequest: {
    id: string;
    company: string | null;
    level: string | null;
    quota: number;
    workLocation: string | null;
    jobDescriptions: string[];
    minEducation: string | null;
    minExperience: string | null;
    department: { name: string } | null;
    position: { name: string } | null;
  };
};

/**
 * Validate a recruitment form token + access code pair.
 *
 * Returns the form link (with recruitment request data) on success,
 * or null if the token is invalid, expired, revoked, or the access code
 * does not match (timing-safe comparison).
 *
 * Callers MUST treat null as a generic auth failure — never leak which
 * check failed in the API response.
 */
export async function validateFormToken(
  token: string,
  accessCode: string
): Promise<ValidatedFormLink | null> {
  const link = await db.recruitmentFormLink.findUnique({
    where: { token },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      accessCode: true,
      recruitmentRequest: {
        select: {
          id: true,
          company: true,
          level: true,
          quota: true,
          workLocation: true,
          jobDescriptions: true,
          minEducation: true,
          minExperience: true,
          department: { select: { name: true } },
          position: { select: { name: true } },
        },
      },
    },
  });

  if (!link || link.status !== "Active") return null;
  if (link.expiresAt && link.expiresAt < new Date()) return null;

  const stored = Buffer.from(link.accessCode);
  const submitted = Buffer.from(accessCode.trim().toUpperCase());
  if (stored.length !== submitted.length || !timingSafeEqual(stored, submitted)) return null;

  return {
    id: link.id,
    status: link.status,
    expiresAt: link.expiresAt,
    recruitmentRequest: link.recruitmentRequest,
  };
}
