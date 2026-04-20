import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function AuthGate({ children }: { children: React.ReactNode }) {
  let session;
  try {
    session = await auth();
  } catch {
    // Auth service unavailable (DB timeout, cold start) — let it through
    // Client will handle session state via useSession
    return <>{children}</>;
  }

  if (!session) {
    redirect("/auth/login");
  }

  // Profile row gone (deleted/truncated after session was issued)
  if (session.user?.profileMissing) {
    redirect("/api/auth/force-logout");
  }

  // JWT exists but user.id missing (legacy guard)
  if (!session.user?.id) {
    redirect("/api/auth/force-logout");
  }

  if (session.user.status === "suspended" || session.user.status === "inactive") {
    redirect("/api/auth/force-logout");
  }

  if (!session.user.isEmailVerified) {
    redirect("/auth/verify?message=Silakan+verifikasi+email+Anda+terlebih+dahulu.");
  }

  if (session.user.mustChangePassword) {
    redirect("/auth/reset-password?force=true");
  }

  return <>{children}</>;
}
