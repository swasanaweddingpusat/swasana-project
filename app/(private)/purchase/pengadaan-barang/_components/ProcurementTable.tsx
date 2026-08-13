"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Eye,
  Pen,
  TrashBinTrash,
  CheckSquare,
  MenuDots,
  ArrowLeft,
  ArrowRight,
} from "@solar-icons/react";
import { cn } from "@/lib/utils";
import type { ProcurementItem } from "@/lib/queries/procurement";

interface ProcurementTableProps {
  items: ProcurementItem[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  totalPending?: number;
  allPagesSelected?: boolean;
  onSelectAllPages?: () => void;
  onClearAllPages?: () => void;
  isSelectingAll?: boolean;
  onPageChange: (page: number) => void;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onApprove?: (id: string) => void;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; dotClass: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING: { label: "Menunggu", dotClass: "bg-amber-500", variant: "outline" },
  APPROVED: { label: "Disetujui", dotClass: "bg-blue-500", variant: "default" },
  REJECTED: { label: "Ditolak", dotClass: "bg-destructive", variant: "destructive" },
  COMPLETED: { label: "Selesai", dotClass: "bg-green-500", variant: "secondary" },
};

const SHORT_INDONESIAN_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const parsed = new Date(date);
  const day = parsed.getDate();
  const month = SHORT_INDONESIAN_MONTHS[parsed.getMonth()] ?? "";
  const year = parsed.getFullYear();
  return `${day} ${month} ${year}`;
}

function buildPageRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = new Set<number>();
  pages.add(1);
  pages.add(total);
  pages.add(current);
  if (current - 1 >= 1) pages.add(current - 1);
  if (current + 1 <= total) pages.add(current + 1);

  const sorted = Array.from(pages).sort((a, b) => a - b);
  const result: (number | "...")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    result.push(sorted[i]);
    if (i < sorted.length - 1 && (sorted[i + 1] - sorted[i]) > 1) {
      result.push("...");
    }
  }
  return result;
}

export function ProcurementTable({
  items,
  total,
  page,
  limit,
  isLoading,
  selectedIds = [],
  onSelectionChange,
  totalPending,
  allPagesSelected = false,
  onSelectAllPages,
  onClearAllPages,
  isSelectingAll = false,
  onPageChange,
  onView,
  onEdit,
  onDelete,
  onApprove,
}: ProcurementTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const pendingIds = items.filter((item) => item.status === "PENDING").map((item) => item.id);
  const selectedPendingIds = selectedIds.filter((id) => pendingIds.includes(id));
  const allSelected = pendingIds.length > 0 && selectedPendingIds.length === pendingIds.length;
  const isIndeterminate = selectedPendingIds.length > 0 && selectedPendingIds.length < pendingIds.length;

  const toggleAll = (checked: boolean) => {
    if (!onSelectionChange) return;
    if (!checked && allPagesSelected && onClearAllPages) {
      onClearAllPages();
      return;
    }
    if (checked) {
      onSelectionChange(Array.from(new Set([...selectedIds, ...pendingIds])));
    } else {
      onSelectionChange(selectedIds.filter((id) => !pendingIds.includes(id)));
    }
  };

  const toggleRow = (id: string, checked: boolean) => {
    if (!onSelectionChange) return;
    if (!checked && allPagesSelected && onClearAllPages) {
      onClearAllPages();
    }
    if (checked) {
      onSelectionChange(Array.from(new Set([...selectedIds, id])));
    } else {
      onSelectionChange(selectedIds.filter((selectedId) => selectedId !== id));
    }
  };

  const showBanner =
    !!onSelectionChange &&
    allSelected &&
    pendingIds.length > 0 &&
    (allPagesSelected || (totalPending ?? 0) > pendingIds.length);

  const selectAllBanner = showBanner ? (
    <div className="bg-primary/5 border-b px-4 py-2.5 text-center text-sm">
      {allPagesSelected ? (
        <span className="text-foreground">
          Semua{" "}
          <span className="font-semibold">{selectedIds.length}</span>{" "}
          pengajuan Menunggu dipilih.{" "}
          <button
            type="button"
            onClick={onClearAllPages}
            className="text-primary font-medium hover:underline"
          >
            Batalkan pilihan
          </button>
        </span>
      ) : (
        <span className="text-foreground">
          <span className="font-semibold">{pendingIds.length}</span>{" "}
          pengajuan dipilih di halaman ini.{" "}
          <button
            type="button"
            onClick={onSelectAllPages}
            disabled={isSelectingAll}
            className="text-primary font-medium hover:underline disabled:opacity-50"
          >
            {isSelectingAll
              ? "Memilih..."
              : `Pilih semua ${totalPending ?? 0} pengajuan Menunggu`}
          </button>
        </span>
      )}
    </div>
  ) : null;

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-border shadow-sm">
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border shadow-sm flex flex-col items-center justify-center py-16 text-muted-foreground">
        <CheckSquare weight="BoldDuotone" className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">Belum ada data pengadaan.</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      {selectAllBanner}

      {/* Desktop table (sm+) */}
      <div className="hidden sm:block overflow-x-auto">
        <Table className="w-full text-sm">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-12 px-3 py-2 text-muted-foreground">
                <Checkbox
                  checked={allSelected}
                  indeterminate={isIndeterminate}
                  onCheckedChange={(checked) => toggleAll(checked === true)}
                  disabled={!onSelectionChange || pendingIds.length === 0}
                  className="cursor-pointer"
                  aria-label="Pilih semua pengajuan Menunggu"
                />
              </TableHead>
              <TableHead className="px-3 py-2 text-muted-foreground">Tanggal</TableHead>
              <TableHead className="px-3 py-2 text-muted-foreground">Venue</TableHead>
              <TableHead className="px-3 py-2 text-muted-foreground">Nama Barang</TableHead>
              <TableHead className="px-3 py-2 text-muted-foreground text-right">Jumlah</TableHead>
              <TableHead className="px-3 py-2 text-muted-foreground">PIC</TableHead>
              <TableHead className="px-3 py-2 text-muted-foreground hidden lg:table-cell">Divisi</TableHead>
              <TableHead className="px-3 py-2 text-muted-foreground">Status</TableHead>
              <TableHead className="px-3 py-2 text-muted-foreground text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const cfg = STATUS_CONFIG[item.status] ?? {
                label: item.status,
                dotClass: "bg-muted-foreground",
                variant: "outline" as const,
              };
              return (
                <TableRow
                  key={item.id}
                  className={cn(
                    "hover:bg-muted/40 transition-colors",
                    selectedIds.includes(item.id) && "bg-muted/20"
                  )}
                >
                  <TableCell className="px-3 py-2">
                    <Checkbox
                      checked={selectedIds.includes(item.id)}
                      onCheckedChange={(checked) => toggleRow(item.id, checked === true)}
                      disabled={!onSelectionChange || item.status !== "PENDING"}
                      className="cursor-pointer"
                      aria-label={item.status === "PENDING" ? "Pilih pengajuan" : "Tidak bisa dipilih"}
                    />
                  </TableCell>
                  <TableCell className="px-3 py-2 text-sm">
                    {formatDate(item.tanggalPermintaan)}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-sm">
                    {item.venue?.name ?? "—"}
                  </TableCell>
                  <TableCell className="px-3 py-2 font-medium text-sm max-w-48">
                    <span className="line-clamp-2">{item.namaBarang}</span>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-sm text-right">
                    {item.jumlahBarang}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-sm">{item.picPenerima}</TableCell>
                  <TableCell className="px-3 py-2 text-sm hidden lg:table-cell">
                    {item.division ?? "—"}
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <Badge
                      variant={cfg.variant}
                      className="flex items-center gap-1.5 w-fit text-xs rounded-full"
                    >
                      <span className={cn("inline-block w-1.5 h-1.5 rounded-full shrink-0", cfg.dotClass)} />
                      {cfg.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-2 py-2 whitespace-nowrap text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="p-1.5 rounded-md hover:bg-muted cursor-pointer"
                          aria-label="Aksi"
                        >
                          <MenuDots
                            weight="BoldDuotone"
                            className="h-4 w-4 text-muted-foreground"
                          />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onView && (
                          <DropdownMenuItem onClick={() => onView(item.id)}>
                            <Eye weight="BoldDuotone" className="h-4 w-4 mr-2" />
                            Lihat Detail
                          </DropdownMenuItem>
                        )}
                        {onEdit && (
                          <DropdownMenuItem onClick={() => onEdit(item.id)}>
                            <Pen weight="BoldDuotone" className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {onApprove && item.status === "PENDING" && (
                          <DropdownMenuItem
                            onClick={() => onApprove(item.id)}
                            className="text-blue-500 focus:text-blue-500"
                          >
                            <CheckSquare weight="BoldDuotone" className="h-4 w-4 mr-2" />
                            Setujui
                          </DropdownMenuItem>
                        )}
                        {onDelete && (
                          <DropdownMenuItem
                            onClick={() => onDelete(item.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <TrashBinTrash weight="BoldDuotone" className="h-4 w-4 mr-2" />
                            Hapus
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card list (<sm) */}
      <div className="block sm:hidden p-4 space-y-3">
        {items.map((item) => {
          const cfg = STATUS_CONFIG[item.status] ?? {
            label: item.status,
            dotClass: "bg-muted-foreground",
            variant: "outline" as const,
          };
          return (
            <div
              key={item.id}
              className={cn(
                "rounded-xl border bg-background p-3 space-y-2",
                selectedIds.includes(item.id) && "border-primary/40 bg-primary/5"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIds.includes(item.id)}
                  onCheckedChange={(checked) => toggleRow(item.id, checked === true)}
                  disabled={!onSelectionChange || item.status !== "PENDING"}
                  className="cursor-pointer"
                  aria-label={item.status === "PENDING" ? "Pilih pengajuan" : "Tidak bisa dipilih"}
                />
                <span className="font-medium text-foreground truncate text-sm">
                  {item.namaBarang}
                </span>
                </div>
                <Badge
                  variant={cfg.variant}
                  className="flex items-center gap-1.5 shrink-0 text-[10px] rounded-full"
                >
                  <span className={cn("inline-block w-1.5 h-1.5 rounded-full shrink-0", cfg.dotClass)} />
                  {cfg.label}
                </Badge>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                <span>{item.venue?.name ?? "—"}</span>
                <span aria-hidden="true">·</span>
                <span>{formatDate(item.tanggalPermintaan)}</span>
                {item.division && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{item.division}</span>
                  </>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                PIC: {item.picPenerima} · Jumlah: {item.jumlahBarang}
              </div>
              <div
                className="flex items-center gap-1 pt-1 border-t border-border"
                onClick={(e) => e.stopPropagation()}
              >
                {onView && (
                  <Button
                    variant="outline"
                    className="h-8 flex-1 text-xs"
                    onClick={() => onView(item.id)}
                  >
                    <Eye weight="BoldDuotone" aria-hidden="true" className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                    Detail
                  </Button>
                )}
                {onEdit && (
                  <Button
                    variant="outline"
                    className="h-8 flex-1 text-xs"
                    onClick={() => onEdit(item.id)}
                  >
                    <Pen weight="BoldDuotone" aria-hidden="true" className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                    Edit
                  </Button>
                )}
                {(onDelete || (onApprove && item.status === "PENDING")) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="p-1.5 rounded-md hover:bg-muted cursor-pointer shrink-0"
                        aria-label="Aksi lainnya"
                      >
                        <MenuDots weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {onApprove && item.status === "PENDING" && (
                        <DropdownMenuItem
                          onClick={() => onApprove(item.id)}
                          className="text-blue-500 focus:text-blue-500"
                        >
                          <CheckSquare weight="BoldDuotone" className="h-4 w-4 mr-2" />
                          Setujui
                        </DropdownMenuItem>
                      )}
                      {onDelete && (
                        <DropdownMenuItem
                          onClick={() => onDelete(item.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <TrashBinTrash weight="BoldDuotone" className="h-4 w-4 mr-2" />
                          Hapus
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center px-4 sm:px-6 py-4 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(page - 1, 1))}
            disabled={page <= 1}
            className="rounded-full"
          >
            <ArrowLeft weight="BoldDuotone" className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Sebelumnya</span>
          </Button>

          {/* Mobile: page X/Y */}
          <span className="text-sm text-muted-foreground sm:hidden">
            {page} / {totalPages}
          </span>

          {/* Desktop: page numbers with ellipsis */}
          <div className="hidden sm:flex items-center gap-1">
            {buildPageRange(page, totalPages).map((item, idx) =>
              item === "..." ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 py-1 text-sm text-muted-foreground select-none"
                >
                  ...
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => onPageChange(item as number)}
                  className={cn(
                    "px-3 py-1 rounded-md text-sm font-medium cursor-pointer",
                    page === item
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  {item}
                </button>
              )
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(page + 1, totalPages))}
            disabled={page >= totalPages}
            className="rounded-full"
          >
            <span className="hidden sm:inline">Berikutnya</span>
            <ArrowRight weight="BoldDuotone" className="w-4 h-4 sm:ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}
