import Link from "next/link";
import { ShieldCross } from "@solar-icons/react";

export const metadata = { title: "Akses Ditolak" };

export default function ForbiddenPage(): React.JSX.Element {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/10">
          <ShieldCross weight="BoldDuotone" className="size-7 text-destructive" />
        </div>
        <h1 className="mt-4 font-heading text-xl text-foreground">Akses Ditolak</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Anda tidak memiliki izin untuk mengakses halaman tersebut.
        </p>
        <Link
          href="/select-module"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Kembali
        </Link>
      </div>
    </div>
  );
}
