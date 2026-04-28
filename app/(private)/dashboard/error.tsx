"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "../../../lib/utils";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className={cn('flex', 'min-h-[50vh]', 'flex-col', 'items-center', 'justify-center', 'text-center')}>
      <AlertTriangle className={cn('h-16', 'w-16', 'text-muted-foreground', 'mb-4')} />
      <h1 className={cn('text-2xl', 'font-bold')}>Terjadi Kesalahan</h1>
      <p className={cn('text-muted-foreground', 'text-sm', 'max-w-md', 'mt-2')}>
        Terjadi kesalahan saat memuat konten dashboard. Silakan coba lagi.
      </p>
      <div className={cn('mt-6', 'flex', 'gap-3')}>
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
