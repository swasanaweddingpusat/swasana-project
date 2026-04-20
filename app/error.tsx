"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center text-center px-4">
      <AlertTriangle className="h-16 w-16 text-muted-foreground mb-4" />
      <h1 className="text-2xl font-bold">Terjadi Kesalahan</h1>
      <p className="text-muted-foreground text-sm max-w-md mt-2">
        Maaf, terjadi kesalahan yang tidak terduga. Silakan coba lagi atau kembali ke dashboard.
      </p>
      <div className="mt-6 flex gap-3">
        <Button variant="outline" onClick={() => reset()}>
          Coba Lagi
        </Button>
        <Link href="/dashboard">
          <Button>Kembali ke Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
