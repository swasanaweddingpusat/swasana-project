import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

export async function getGroups(page = 1, limit = 10) {
  "use cache";
  cacheTag("groups");
  cacheLife("minutes");

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    db.userGroup.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        leaderId: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
        leader: {
          select: { id: true, fullName: true, email: true, avatarUrl: true },
        },
        members: {
          select: {
            userId: true,
            sortOrder: true,
            profile: {
              select: {
                id: true,
                fullName: true,
                email: true,
                avatarUrl: true,
                role: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        _count: { select: { members: true } },
      },
      orderBy: { sortOrder: "asc" },
      skip,
      take: limit,
    }),
    db.userGroup.count(),
  ]);

  return { data, total, page, limit };
}

export async function getGroupById(groupId: string) {
  "use cache";
  cacheTag("groups");
  cacheLife("minutes");

  return db.userGroup.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      description: true,
      leaderId: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
      leader: {
        select: { id: true, fullName: true, email: true, avatarUrl: true },
      },
      members: {
        select: {
          userId: true,
          sortOrder: true,
          profile: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatarUrl: true,
              role: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
      _count: { select: { members: true } },
    },
  });
}

export type GroupsQueryResult = Awaited<ReturnType<typeof getGroups>>;
export type GroupQueryItem = GroupsQueryResult["data"][number];
