import { Skeleton } from "@/components/ui/skeleton";

export default function UserManagementLoading() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>

      {/* Table */}
      <div className="rounded-md border">
        {/* Table header */}
        <div className="grid grid-cols-6 gap-4 border-b px-4 py-3">
          {["Nama", "Email", "Role", "Status", "Email Verified", "Aksi"].map((col) => (
            <Skeleton key={col} className="h-4 w-full max-w-[80px]" />
          ))}
        </div>

        {/* Table rows */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="grid grid-cols-6 items-center gap-4 border-b px-4 py-3 last:border-0">
            {/* Avatar + Name */}
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
            {/* Email */}
            <Skeleton className="h-4 w-36" />
            {/* Role badge */}
            <Skeleton className="h-5 w-20 rounded-full" />
            {/* Status badge */}
            <Skeleton className="h-5 w-16 rounded-full" />
            {/* Email verified badge */}
            <Skeleton className="h-5 w-16 rounded-full" />
            {/* Actions */}
            <div className="flex justify-end gap-1">
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
