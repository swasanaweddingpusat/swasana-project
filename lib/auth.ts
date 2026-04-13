import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validations/auth";

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
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await db.user.findUnique({
          where: { email },
          include: { profile: true },
        });

        if (!user || !user.password) return null;

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) return null;

        if (!user.profile?.isEmailVerified) return null;

        // Update last login
        await db.profile.update({
          where: { userId: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.profile?.fullName ?? user.name,
          image: user.profile?.avatarUrl ?? user.image,
          roleId: user.profile?.roleId ?? null,
          mustChangePassword: user.profile?.mustChangePassword ?? false,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.roleId = (user as any).roleId;
        token.mustChangePassword = (user as any).mustChangePassword;
      }

      // Refresh profile data on each token update
      if (token.id) {
        const profile = await db.profile.findUnique({
          where: { userId: token.id as string },
          select: {
            roleId: true,
            mustChangePassword: true,
            fullName: true,
            avatarUrl: true,
            isEmailVerified: true,
          },
        });
        if (profile) {
          token.roleId = profile.roleId;
          token.mustChangePassword = profile.mustChangePassword;
          token.name = profile.fullName;
          token.picture = profile.avatarUrl;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        (session.user as any).roleId = token.roleId;
        (session.user as any).mustChangePassword = token.mustChangePassword;
      }
      return session;
    },
  },
});
