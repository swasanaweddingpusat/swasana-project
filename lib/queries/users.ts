import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import type { UserFilters } from "@/types/user";

const PROFILE_SELECT = {
  id: true,
  fullName: true,
  nickName: true,
  phoneNumber: true,
  avatarUrl: true,
  status: true,
  dataScope: true,
  roleId: true,
  isEmailVerified: true,
  mustChangePassword: true,
  lastLoginAt: true,
  invitedAt: true,
  createdAt: true,
  updatedAt: true,
  // Personal data
  placeOfBirth: true,
  dateOfBirth: true,
  ktpAddress: true,
  currentAddress: true,
  motherName: true,
  maritalStatus: true,
  numberOfChildren: true,
  lastEducation: true,
  // Emergency contact
  emergencyContactName: true,
  emergencyContactRel: true,
  emergencyContactPhone: true,
  // Relations
  role: { select: { id: true, name: true } },
  userVenueAccess: {
    select: {
      id: true,
      scope: true,
      venue: { select: { id: true, name: true } },
    },
  },
  dataGroupMemberships: {
    select: {
      group: { select: { id: true, name: true } },
    },
  },
} as const;

export async function getUsers(filters: UserFilters = {}) {
  "use cache";
  cacheTag("users");
  cacheLife("minutes");

  const { search, roleId, status, venueId, dataScope, page = 1, limit = 20 } = filters;

  const where = {
    profile: {
      ...(roleId && { roleId }),
      ...(dataScope && { dataScope }),
      ...(status === "pending"
        ? { isEmailVerified: false }
        : status
        ? { status: status as "active" | "inactive" | "suspended" }
        : {}),
      ...(venueId && { userVenueAccess: { some: { venueId } } }),
    },
    ...(search && {
      OR: [
        { email: { contains: search, mode: "insensitive" as const } },
        { name: { contains: search, mode: "insensitive" as const } },
        { profile: { fullName: { contains: search, mode: "insensitive" as const } } },
      ],
    }),
  };

  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        profile: { select: PROFILE_SELECT },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.user.count({ where }),
  ]);

  return { users, total, page, limit };
}

export async function getUserById(userId: string) {
  "use cache";
  cacheTag("users");
  cacheLife("minutes");

  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      profile: { select: PROFILE_SELECT },
    },
  });
}

export type UsersQueryResult = Awaited<ReturnType<typeof getUsers>>;
export type UserQueryItem = UsersQueryResult["users"][number];
