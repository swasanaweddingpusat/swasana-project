import { DefaultSession, DefaultUser } from "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      roleId: string | null;
      mustChangePassword: boolean;
    };
  }

  interface User extends DefaultUser {
    roleId?: string | null;
    mustChangePassword?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    roleId?: string | null;
    mustChangePassword?: boolean;
  }
}
