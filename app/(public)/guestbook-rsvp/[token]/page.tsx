import { Suspense } from "react";
import { GuestbookRsvpClient } from "./_components/GuestbookRsvpClient";

export const metadata = {
  title: "Konfirmasi Kehadiran — Swasana",
};

export default function GuestbookRsvpPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  // Defer `params` access to inside the Suspense boundary. Awaiting it at the
  // page level would block the entire page from rendering (Next.js 16).
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Memuat...</div>}>
      {params.then(({ token }) => (
        <GuestbookRsvpClient token={token} />
      ))}
    </Suspense>
  );
}
