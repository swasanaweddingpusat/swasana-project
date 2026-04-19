export interface SessionUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export interface Session {
  user?: SessionUser;
  expires: string;
}

export async function fetchCurrentUser(): Promise<Session | null> {
  const res = await fetch("/api/auth/session");
  if (!res.ok) throw new Error("Failed to fetch session");
  const data = await res.json();
  // NextAuth returns {} when no session exists
  if (!data || !data.user) return null;
  return data as Session;
}
