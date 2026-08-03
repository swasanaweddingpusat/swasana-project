import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { SessionProvider } from "@/components/providers/session-provider";

// Reads the session cookie (runtime data) and hydrates SessionProvider for the
// entire private subtree — the only place useSession is consumed. Kept in a
// child component behind <Suspense> so the cookie read doesn't block the static
// shell of routes that render before auth resolves (Cache Components).
async function SessionBoundary({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return <SessionProvider session={session}>{children}</SessionProvider>;
}

export default function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // No auth gate here — proxy.ts handles redirect for unauthenticated users.
  // Dashboard layout renders the shell (sidebar + header) instantly.
  // Auth-dependent checks (mustChangePassword, suspended, etc.) are handled
  // by AuthGate wrapping only the content area inside dashboard/layout.tsx.
  return (
    <Suspense fallback={null}>
      <SessionBoundary>{children}</SessionBoundary>
    </Suspense>
  );
}
