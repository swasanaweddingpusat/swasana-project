import { DefaultSession, DefaultUser } from "next-auth";
import { JWT } from "next-auth/jwt";

type ProfileStatus = "active" | "inactive" | "suspended";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      profileId: string;
      roleId: string | null;
      mustChangePassword: boolean;
      isEmailVerified: boolean;
      status: ProfileStatus;
      profileMissing?: boolean;
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
    mustChangePassword?: boolean;
    isEmailVerified?: boolean;
    status?: ProfileStatus;
    profileCachedAt?: number;
    profileMissing?: boolean;
  }
}
