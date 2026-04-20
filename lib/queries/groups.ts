import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

export async function getGroups() {
  "use cache";
  cacheTag("groups");
  cacheLife("minutes");

  return db.userGroup.findMany({
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
  });
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
export type GroupQueryItem = GroupsQueryResult[number];
