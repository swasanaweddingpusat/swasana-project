import { db } from "@/lib/db";
import { buildOwnerScopeWhere } from "@/lib/access-control";
import type { DataScope } from "@/types/user";
import type { Prisma } from "@prisma/client";

export interface GuestbookEntriesOptions {
  page?: number;
  pageSize?: number;
}

export interface PaginatedGuestbookEntries {
  data: GuestbookEntryRow[];
  total: number;
  page: number;
  pageSize: number;
}

const guestbookEntrySelect = {
  id: true,
  visitorName: true,
  company: true,
  email: true,
  phoneNumber: true,
  idNumber: true,
  visitorPhotoUrl: true,
  idPhotoUrl: true,
  purpose: true,
  purposeNote: true,
  interactionType: true,
  onlineMedium: true,
  meetingUrl: true,
  meetingLocation: true,
  scheduledAt: true,
  numberOfGuests: true,
  checkInAt: true,
  checkOutAt: true,
  notes: true,
  guestCode: true,
  phoneNumberNorm: true,
  bitrixContactId: true,
  bitrixName: true,
  visitStatus: true,
  notJoinReason: true,
  venueId: true,
  salesId: true,
  createdAt: true,
  host: { select: { id: true, fullName: true } },
  createdBy: { select: { id: true, fullName: true } },
  sales: { select: { id: true, fullName: true } },
  venue: { select: { id: true, name: true } },
} satisfies Prisma.GuestbookEntrySelect;

type GuestbookEntryRow = Prisma.GuestbookEntryGetPayload<{ select: typeof guestbookEntrySelect }>;

export async function getGuestbookEntries(
  profileId: string | undefined,
  dataScope: DataScope | undefined,
  options?: GuestbookEntriesOptions
): Promise<PaginatedGuestbookEntries> {
  const scopeWhere = (await buildOwnerScopeWhere(profileId, dataScope, "salesId")) as Prisma.GuestbookEntryWhereInput;

  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options?.pageSize ?? 50));

  const [data, total] = await Promise.all([
    db.guestbookEntry.findMany({
      where: scopeWhere,
      select: guestbookEntrySelect,
      orderBy: { checkInAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.guestbookEntry.count({ where: scopeWhere }),
  ]);

  return { data, total, page, pageSize };
}

export type GuestbookEntryItem = GuestbookEntryRow;
