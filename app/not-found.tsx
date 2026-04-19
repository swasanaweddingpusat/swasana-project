import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center text-center px-4">
      <FileQuestion className="h-16 w-16 text-muted-foreground mb-4" />
      <h1 className="text-2xl font-bold">Halaman Tidak Ditemukan</h1>
      <p className="text-muted-foreground text-sm max-w-md mt-2">
        Maaf, halaman yang Anda cari tidak ditemukan atau telah dipindahkan.
      </p>
      <div className="mt-6">
        <Button asChild>
          <Link href="/dashboard">Kembali ke Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
