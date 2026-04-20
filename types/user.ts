export type ProfileStatus = "active" | "inactive" | "suspended";
export type DataScope = "own" | "group" | "all";
export type VenueAccessScope = "general" | "individual";

// ─── Core Profile ─────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  fullName?: string | null;
  nickName?: string | null;
  phoneNumber?: string | null;
  avatarUrl?: string | null;

  // Personal data
  placeOfBirth?: string | null;
  dateOfBirth?: string | null;
  ktpAddress?: string | null;
  currentAddress?: string | null;
  motherName?: string | null;
  maritalStatus?: string | null;
  numberOfChildren?: number | null;
  lastEducation?: string | null;

  // Emergency contact
  emergencyContactName?: string | null;
  emergencyContactRel?: string | null;
  emergencyContactPhone?: string | null;

  // Access
  roleId?: string | null;
  dataScope: DataScope;
  status: ProfileStatus;
  isEmailVerified: boolean;
  mustChangePassword: boolean;
  invitedBy?: string | null;
  invitedAt?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── User with relations ──────────────────────────────────────────────────────

export interface UserVenueAccess {
  id: string;
  scope: VenueAccessScope;
  venue: { id: string; name: string };
}

export interface UserGroupMembership {
  group: { id: string; name: string };
}

export interface UserWithVenues {
  id: string;
  email: string;
  name?: string | null;
  createdAt: string;
  updatedAt: string;
  profile: (UserProfile & {
    role?: { id: string; name: string } | null;
    userVenueAccess: UserVenueAccess[];
    dataGroupMemberships: UserGroupMembership[];
  }) | null;
}

// ─── Input types ─────────────────────────────────────────────────────────────

export interface InviteUserInput {
  email: string;
  fullName: string;
  roleId: string;
  venueIds: string[];
  dataScope?: DataScope;
}

export interface UpdateUserInput {
  userId: string;
  fullName?: string;
  nickName?: string;
  phoneNumber?: string;
  roleId?: string;
  venueIds?: string[];
  status?: ProfileStatus;
  dataScope?: DataScope;

  // Personal data
  placeOfBirth?: string;
  dateOfBirth?: string;
  ktpAddress?: string;
  currentAddress?: string;
  motherName?: string;
  maritalStatus?: string;
  numberOfChildren?: number;
  lastEducation?: string;

  // Emergency contact
  emergencyContactName?: string;
  emergencyContactRel?: string;
  emergencyContactPhone?: string;
}

// ─── Data Groups ─────────────────────────────────────────────────────────────

export interface UserGroupMember {
  userId: string;
  sortOrder: number;
  profile: {
    id: string;
    fullName?: string | null;
    email: string;
    avatarUrl?: string | null;
    role?: { id: string; name: string } | null;
  };
}

export interface UserGroup {
  id: string;
  name: string;
  description?: string | null;
  leaderId?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  leader?: { id: string; fullName?: string | null; email: string } | null;
  members: UserGroupMember[];
  _count?: { members: number };
}

// ─── Roles & Permissions ─────────────────────────────────────────────────────

export interface RoleWithPermissions {
  id: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  permissions: { id: string; module: string; action: string }[];
  _count?: { profiles: number };
}

export interface PermissionMatrix {
  [module: string]: {
    [action: string]: boolean;
  };
}

// ─── Filters ─────────────────────────────────────────────────────────────────

export interface UserFilters {
  search?: string;
  roleId?: string;
  status?: ProfileStatus | "pending";
  venueId?: string;
  dataScope?: DataScope;
  page?: number;
  limit?: number;
}
