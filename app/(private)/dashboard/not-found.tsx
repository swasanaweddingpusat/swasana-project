import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "../../../lib/utils";

export default function DashboardNotFound() {
  return (
    <div className={cn('flex', 'min-h-[50vh]', 'flex-col', 'items-center', 'justify-center', 'text-center')}>
      <FileQuestion className={cn('h-16', 'w-16', 'text-muted-foreground', 'mb-4')} />
      <h1 className={cn('text-2xl', 'font-bold')}>Halaman Tidak Ditemukan</h1>
      <p className={cn('text-muted-foreground', 'text-sm', 'max-w-md', 'mt-2')}>
        Halaman yang Anda cari tidak tersedia di dashboard ini.
      </p>
      <div className="mt-6">
        <Link href="/dashboard">
          <Button>Kembali ke Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
