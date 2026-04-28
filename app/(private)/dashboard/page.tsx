import { Metadata } from "next";
import { ShieldX } from "lucide-react";
import { cn } from "../../../lib/utils";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  return (
    <div className="space-y-6">
      {params.error === "forbidden" && (
        <div className={cn('flex', 'items-center', 'gap-3', 'p-4', 'bg-red-50', 'border', 'border-red-200', 'rounded-lg', 'text-red-800')}>
          <ShieldX className={cn('h-5', 'w-5', 'shrink-0')} />
          <div>
            <p className={cn('font-semibold', 'text-sm')}>Akses Ditolak</p>
            <p className={cn('text-sm', 'mt-0.5')}>Anda tidak memiliki izin untuk mengakses halaman tersebut. Hubungi admin untuk mendapatkan akses.</p>
          </div>
        </div>
      )}
      <div>
        <h1 className={cn('text-2xl', 'font-bold', 'text-gray-900')}>Dashboard</h1>
        <p className="text-gray-500">Selamat datang di Swasana Wedding</p>
      </div>
    </div>
  );
}
