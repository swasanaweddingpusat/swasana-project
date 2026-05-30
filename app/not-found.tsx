import Link from "next/link";
import { QuestionCircle } from "@solar-icons/react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center text-center px-4">
      <QuestionCircle weight="BoldDuotone" className="h-16 w-16 text-muted-foreground mb-4" />
      <h1 className="text-2xl font-bold">Halaman Tidak Ditemukan</h1>
      <p className="text-muted-foreground text-sm max-w-md mt-2">
        Maaf, halaman yang Anda cari tidak ditemukan atau telah dipindahkan.
      </p>
      <div className="mt-6">
        <Link href="/dashboard">
          <Button>Kembali ke Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
