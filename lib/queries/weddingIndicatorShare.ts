import { db } from "@/lib/db";

export async function getShareByIndicatorId(weddingIndicatorId: string) {
  return db.weddingIndicatorShare.findUnique({
    where: { weddingIndicatorId },
    select: {
      id: true,
      token: true,
      accessCode: true,
      status: true,
      viewedAt: true,
      lastEditedAt: true,
      createdAt: true,
    },
  });
}

export async function getShareByToken(token: string) {
  return db.weddingIndicatorShare.findUnique({
    where: { token },
    select: {
      id: true,
      weddingIndicatorId: true,
      accessCode: true,
      status: true,
      viewedAt: true,
      lastEditedAt: true,
      weddingIndicator: {
        select: {
          id: true,
          coupleName: true,
          eventDate: true,
          venueId: true,
          createdById: true,
          eventManagerName: true,
          eventManagerRating: true,
          woName: true,
          woRating: true,
          ballroomFacilitiesRating: true,
          ballroomCleanlinessRating: true,
          vendorsRating: true,
          salesRating: true,
          recommendationScore: true,
          satisfactionScore: true,
          allowancePercentage: true,
          allowanceNominal: true,
          questionnaireData: true,
          venue: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });
}
