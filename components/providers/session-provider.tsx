"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

interface SessionProviderProps {
  children: React.ReactNode;
  session?: Session | null;
}

// JWT strategy — the session cookie already contains the decoded claims.
// Passing `session` (server-hydrated) prevents the initial /api/auth/session
// round-trip entirely. Profile refresh happens inside lib/auth.ts jwt callback
// on its own 10-minute TTL.
export function SessionProvider({ children, session }: SessionProviderProps) {
  return (
    <NextAuthSessionProvider
      session={session}
      refetchInterval={0}
      refetchOnWindowFocus={false}
    >
      {children}
    </NextAuthSessionProvider>
  );
}
