import { Suspense } from "react";
import { ApplicationForm } from "./_components/ApplicationForm";

// publicToken is always randomBytes(32).toString("hex") — 64 lowercase hex
// chars, no whitespace. Guards against the "Copy Link" clipboard message
// (link + "Kode Akses: XXXXXX" on the next line) being pasted whole into the
// address bar, which otherwise lands here as a mangled token and surfaces a
// misleading "Lowongan Tidak Tersedia" instead of "link tidak valid".
const TOKEN_RE = /^[a-f0-9]{64}$/;

function InvalidLink() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-lg font-heading font-semibold text-foreground">Link Tidak Valid</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Pastikan Anda membuka link pendaftaran saja, tanpa teks kode akses yang menyertainya.
        </p>
      </div>
    </div>
  );
}

export default function ApplyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  // Defer `params` access to inside the Suspense boundary. Awaiting it at the
  // page level would block the entire page from rendering (Next.js 16).
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Memuat...</div>}>
      {params.then(({ token }) => {
        if (!TOKEN_RE.test(token.trim())) return <InvalidLink />;
        return <ApplicationForm token={token} />;
      })}
    </Suspense>
  );
}
