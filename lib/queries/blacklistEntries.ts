import { db } from "@/lib/db";

export async function getBlacklistEntries() {
  return db.blacklistEntry.findMany({
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      reason: true,
      blacklistedAt: true,
      createdAt: true,
      blacklistedBy: { select: { id: true, fullName: true } },
    },
    orderBy: { blacklistedAt: "desc" },
    take: 200,
  });
}

export type BlacklistEntryItem = Awaited<ReturnType<typeof getBlacklistEntries>>[number];
