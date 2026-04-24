export default function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // No auth gate here — proxy.ts handles redirect for unauthenticated users.
  // Dashboard layout renders the shell (sidebar + header) instantly.
  // Auth-dependent checks (mustChangePassword, suspended, etc.) are handled
  // by AuthGate wrapping only the content area inside dashboard/layout.tsx.
  return <>{children}</>;
}
