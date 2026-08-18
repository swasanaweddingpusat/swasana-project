import { db } from "@/lib/db";

export async function getAnnouncements() {
  return db.announcement.findMany({
    select: {
      id: true,
      title: true,
      category: true,
      priority: true,
      status: true,
      publishedAt: true,
      createdAt: true,
      createdBy: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export type AnnouncementItem = Awaited<ReturnType<typeof getAnnouncements>>[number];

export async function getAnnouncementById(id: string) {
  return db.announcement.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      category: true,
      content: true,
      priority: true,
      targetAudience: true,
      status: true,
      publishedAt: true,
      venueId: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { id: true, fullName: true } },
      venue: { select: { id: true, name: true } },
      comments: {
        select: {
          id: true,
          content: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              fullName: true,
              role: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      readers: {
        select: {
          id: true,
          seenAt: true,
          reader: {
            select: {
              id: true,
              fullName: true,
              role: { select: { name: true } },
            },
          },
        },
      },
      _count: { select: { readers: true } },
    },
  });
}

export type AnnouncementDetail = Awaited<ReturnType<typeof getAnnouncementById>>;
