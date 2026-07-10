import { db } from "@/lib/db";
import { WeddingIndicatorFilters } from "@/lib/validations/weddingIndicator";
import { Prisma } from "@prisma/client";

export async function getWeddingIndicators(filters: WeddingIndicatorFilters) {
  const { page = 1, limit = 10, search, venueId, dateFrom, dateTo } = filters;

  const where: Prisma.WeddingIndicatorWhereInput = {};

  if (search) {
    where.coupleName = {
      contains: search,
      mode: "insensitive",
    };
  }

  if (venueId) {
    where.venueId = venueId;
  }

  if (dateFrom || dateTo) {
    where.eventDate = {};
    if (dateFrom) {
      where.eventDate.gte = dateFrom;
    }
    if (dateTo) {
      where.eventDate.lte = dateTo;
    }
  }

  const [data, total] = await Promise.all([
    db.weddingIndicator.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        coupleName: true,
        eventDate: true,
        venue: {
          select: { id: true, name: true },
        },
        satisfactionScore: true,
        allowancePercentage: true,
        allowanceNominal: true,
        createdAt: true,
      },
    }),
    db.weddingIndicator.count({ where }),
  ]);

  return {
    data,
    total,
    page,
    limit,
    pageCount: Math.ceil(total / limit),
  };
}

export async function getWeddingIndicatorById(id: string) {
  return db.weddingIndicator.findUnique({
    where: { id },
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
      createdAt: true,
      updatedAt: true,
      venue: {
        select: { id: true, name: true },
      },
      createdBy: {
        select: { id: true, fullName: true },
      },
    },
  });
}

export async function getWeddingIndicatorsByVenue() {
  const results = await db.weddingIndicator.groupBy({
    by: ["venueId"],
    _count: {
      id: true,
    },
  });

  // Fetch venue names for each group
  const venueIds = results.map((r) => r.venueId);
  const venues = await db.venue.findMany({
    where: { id: { in: venueIds } },
    select: { id: true, name: true },
    take: 500,
  });

  const venueMap = new Map(venues.map((v) => [v.id, v.name]));

  return results.map((r) => ({
    venueId: r.venueId,
    venueName: venueMap.get(r.venueId) || "Unknown",
    count: r._count.id,
  }));
}
