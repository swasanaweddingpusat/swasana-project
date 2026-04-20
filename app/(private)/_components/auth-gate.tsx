import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function AuthGate({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session) {
    redirect("/auth/login");
  }

  // JWT exists but user no longer in DB (truncated/deleted) — force clear cookie
  if (!session.user?.id) {
    redirect("/api/auth/force-logout");
  }

  // Mid-session account deactivation — force re-auth
  if (session.user.status === "suspended" || session.user.status === "inactive") {
    redirect("/api/auth/force-logout");
  }

  // Email verification lost mid-session — e.g., admin cleared flag
  if (!session.user.isEmailVerified) {
    redirect("/api/auth/force-logout");
  }

  if (session.user.mustChangePassword) {
    redirect("/auth/reset-password?force=true");
  }

  return <>{children}</>;
}
