import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import type { UserFilters } from "@/types/user";
import { resolveAvatarUrl } from "@/lib/storage";

const PROFILE_SELECT = {
  id: true,
  fullName: true,
  nickName: true,
  phoneNumber: true,
  avatarUrl: true,
  status: true,
  dataScope: true,
  roleId: true,
  managerId: true,
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

  const { search, roleId, status, dataScope, page = 1, limit = 20 } = filters;

  // Status filter mapping:
  //  - "verified" / "pending" → derived from isEmailVerified (not a Profile.status)
  //  - "active" / "inactive" / "suspended" → literal Profile.status
  //  - undefined (default) → hide inactive accounts (soft-deleted / detached sales)
  //    so they don't clutter the list; still reachable via the explicit "Nonaktif" filter.
  const statusWhere = (() => {
    if (status === "verified") return { isEmailVerified: true, status: { not: "inactive" as const } };
    if (status === "pending") return { isEmailVerified: false, status: { not: "inactive" as const } };
    if (status === "active" || status === "inactive" || status === "suspended") {
      return { status };
    }
    return { status: { not: "inactive" as const } };
  })();

  const where = {
    profile: {
      ...(roleId && { roleId }),
      ...(dataScope && { dataScope }),
      ...statusWhere,
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

  const resolvedUsers = users.map((u) => ({
    ...u,
    profile: u.profile ? { ...u.profile, avatarUrl: resolveAvatarUrl(u.profile.avatarUrl) } : null,
  }));

  return { users: resolvedUsers, total, page, limit };
}

export async function getUserById(userId: string) {
  "use cache";
  cacheTag("users");
  cacheLife("minutes");

  const u = await db.user.findUnique({
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

  if (!u) return null;

  return {
    ...u,
    profile: u.profile ? { ...u.profile, avatarUrl: resolveAvatarUrl(u.profile.avatarUrl) } : null,
  };
}

export type UsersQueryResult = Awaited<ReturnType<typeof getUsers>>;
export type UserQueryItem = UsersQueryResult["users"][number];

export async function getManagerProfiles() {
  "use cache";
  cacheTag("users");
  cacheLife("minutes");

  return db.profile.findMany({
    where: { status: "active", role: { name: { in: ["manager", "manager-mice"] } } },
    select: { id: true, fullName: true, role: { select: { name: true } } },
    orderBy: { fullName: "asc" },
  });
}

export type ManagerProfile = Awaited<ReturnType<typeof getManagerProfiles>>[number];

export async function getMentionableUsers() {
  "use cache";
  cacheTag("users");
  cacheLife("minutes");

  const profiles = await db.profile.findMany({
    where: { status: "active" },
    select: {
      id: true,
      fullName: true,
      avatarUrl: true,
      role: { select: { name: true } },
    },
    orderBy: { fullName: "asc" },
    take: 200,
  });

  return profiles.map((p) => ({ ...p, avatarUrl: resolveAvatarUrl(p.avatarUrl) }));
}

export type MentionableUser = Awaited<ReturnType<typeof getMentionableUsers>>[number];

export async function getAssignableSalesUsers() {
  return db.profile.findMany({
    where: {
      status: "active",
      role: { name: { in: ["sales", "sales-mice"] } },
    },
    select: {
      id: true,
      fullName: true,
      role: { select: { name: true } },
    },
    orderBy: { fullName: "asc" },
    take: 200,
  });
}

export type AssignableSalesUser = Awaited<ReturnType<typeof getAssignableSalesUsers>>[number];
