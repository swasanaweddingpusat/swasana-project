import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { loginSchema } from "@/lib/validations/auth";

// Dummy hash ensures bcrypt always runs — timing-attack defense
const DUMMY_HASH = "$2b$12$aaaaaaaaaaaaaaaaaaaaaOaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const PROFILE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function isAccountLocked(email: string): Promise<boolean> {
  try {
    const since = new Date(Date.now() - LOCKOUT_WINDOW_MS);
    const recentFailures = await db.activityLog.count({
      where: {
        action: "auth.login_failed",
        entityId: email,
        createdAt: { gte: since },
      },
    });
    return recentFailures >= MAX_FAILED_ATTEMPTS;
  } catch {
    // If DB is unavailable, don't lock out — fail open for login
    return false;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const ip =
          request.headers.get("x-forwarded-for") ??
          request.headers.get("x-real-ip") ??
          "unknown";
        const ua = request.headers.get("user-agent") ?? undefined;

        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // Check account lockout via ActivityLog (no Redis needed)
        if (await isAccountLocked(email)) {
          await logAudit({
            action: "auth.login_blocked",
            result: "failure",
            entityType: "auth",
            entityId: email,
            description: "Login diblokir — terlalu banyak percobaan gagal",
            ipAddress: ip,
            userAgent: ua,
          });
          return null;
        }

        const user = await db.user.findUnique({
          where: { email },
          include: { profile: true },
        });

        // Always run bcrypt even if user not found (timing-attack defense)
        const passwordToCheck = user?.password ?? DUMMY_HASH;
        const isValidPassword = await bcrypt.compare(password, passwordToCheck);

        const isValid =
          !!user &&
          isValidPassword &&
          user.profile?.isEmailVerified === true &&
          user.profile?.status === "active";

        if (!isValid) {
          await logAudit({
            action: "auth.login_failed",
            result: "failure",
            entityType: "auth",
            entityId: email,
            description: "Login gagal — kredensial salah atau akun tidak aktif",
            ipAddress: ip,
            userAgent: ua,
          });
          return null;
        }

        await db.profile.update({
          where: { userId: user.id },
          data: { lastLoginAt: new Date() },
        });

        await logAudit({
          userId: user.profile!.id,
          action: "auth.login_success",
          result: "success",
          entityType: "auth",
          entityId: user.profile!.id,
          description: "Login berhasil",
          ipAddress: ip,
          userAgent: ua,
        });

        return {
          id: user.id,
          email: user.email,
          name: user.profile?.fullName ?? user.name,
          image: user.profile?.avatarUrl ?? user.image,
          roleId: user.profile?.roleId ?? null,
          mustChangePassword: user.profile?.mustChangePassword ?? false,
          isEmailVerified: true, // If authorize() passes, user is verified
          status: user.profile?.status ?? "active",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.roleId = user.roleId ?? null;
        token.mustChangePassword = user.mustChangePassword ?? false;
        token.isEmailVerified = user.isEmailVerified ?? false;
        token.status = user.status ?? "active";
        token.profileCachedAt = Date.now();
      }

      // Only refresh profile from DB when cache has expired (reduces DB load)
      const cachedAt = (token.profileCachedAt as number | undefined) ?? 0;
      const cacheExpired = Date.now() - cachedAt > PROFILE_CACHE_TTL_MS;

      if (token.id && cacheExpired) {
        try {
          const profile = await db.profile.findUnique({
            where: { userId: token.id as string },
            select: {
              id: true,
              roleId: true,
              mustChangePassword: true,
              fullName: true,
              avatarUrl: true,
              isEmailVerified: true,
              status: true,
            },
          });
          if (profile) {
            token.profileId = profile.id;
            token.roleId = profile.roleId;
            token.mustChangePassword = profile.mustChangePassword;
            token.isEmailVerified = profile.isEmailVerified;
            token.status = profile.status;
            token.name = profile.fullName;
            token.picture = profile.avatarUrl;
          } else {
            // User no longer exists in DB (truncated/deleted) — invalidate session
            return {} as typeof token;
          }
          token.profileCachedAt = Date.now();
        } catch {
          // DB call failed (AbortError, timeout, etc.) — use stale token data
          // Extend cache so we don't retry immediately
          token.profileCachedAt = Date.now();
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = (token.id as string) ?? "";
        session.user.profileId = (token.profileId as string) ?? "";
        session.user.roleId = (token.roleId as string | null) ?? null;
        session.user.mustChangePassword = (token.mustChangePassword as boolean) ?? false;
        session.user.isEmailVerified = (token.isEmailVerified as boolean) ?? false;
        session.user.status = (token.status as "active" | "inactive" | "suspended") ?? "active";
      }
      return session;
    },
  },
});
