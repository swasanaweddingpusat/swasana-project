import { db } from "@/lib/db";

export async function getGuestbookEntries() {
  return db.guestbookEntry.findMany({
    select: {
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
      numberOfGuests: true,
      checkInAt: true,
      checkOutAt: true,
      notes: true,
      guestCode: true,
      visitStatus: true,
      notJoinReason: true,
      venueId: true,
      createdAt: true,
      host: { select: { id: true, fullName: true } },
      createdBy: { select: { id: true, fullName: true } },
      venue: { select: { id: true, name: true } },
    },
    orderBy: { checkInAt: "desc" },
    take: 200,
  });
}

export type GuestbookEntryItem = Awaited<ReturnType<typeof getGuestbookEntries>>[number];
