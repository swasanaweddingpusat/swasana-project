import { Suspense } from "react";
import { InviteApplicationForm } from "./_components/InviteApplicationForm";

export default function ApplyInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  // Defer `params` access to inside the Suspense boundary. Awaiting it at the
  // page level would block the entire page from rendering (Next.js 16).
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Memuat...</div>}>
      {params.then(({ token }) => (
        <InviteApplicationForm token={token} />
      ))}
    </Suspense>
  );
}
