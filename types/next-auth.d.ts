import { DefaultSession, DefaultUser } from "next-auth";
import type { JWT } from "next-auth/jwt"; // eslint-disable-line @typescript-eslint/no-unused-vars

type ProfileStatus = "active" | "inactive" | "suspended";
type DataScope = "own" | "group" | "all";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      profileId: string;
      roleId: string | null;
      roleName: string | null;
      isSuperAdmin: boolean;
      mustChangePassword: boolean;
      isEmailVerified: boolean;
      status: ProfileStatus;
      profileMissing?: boolean;
      dataScope: DataScope;
    };
  }

  interface User extends DefaultUser {
    roleId?: string | null;
    mustChangePassword?: boolean;
    isEmailVerified?: boolean;
    status?: ProfileStatus;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    profileId?: string;
    roleId?: string | null;
    roleName?: string | null;
    isSuperAdmin?: boolean;
    mustChangePassword?: boolean;
    isEmailVerified?: boolean;
    status?: ProfileStatus;
    profileCachedAt?: number;
    profileMissing?: boolean;
    dataScope?: DataScope;
  }
}
