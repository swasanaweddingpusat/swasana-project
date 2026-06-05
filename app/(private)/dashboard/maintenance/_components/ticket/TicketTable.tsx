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
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  ArrowRight,
  MenuDots,
  Pen,
  Eye,
  TrashBinTrash,
  Gallery,
} from "@solar-icons/react";
import { cn } from "@/lib/utils";
import type { MaintenanceTicketItem } from "@/lib/queries/maintenance";

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function StatusDot({ statusName }: { statusName: string }) {
  const lower = statusName.toLowerCase();
  let color = "bg-muted-foreground";
  if (lower.includes("done") || lower.includes("selesai") || lower.includes("complete")) {
    color = "bg-green-500";
  } else if (lower.includes("reject") || lower.includes("cancel") || lower.includes("batal")) {
    color = "bg-destructive";
  } else if (lower.includes("progress") || lower.includes("proses") || lower.includes("open")) {
    color = "bg-blue-500";
  } else if (lower.includes("pending") || lower.includes("menunggu")) {
    color = "bg-yellow-500";
  }
  return <span className={cn("inline-block w-2 h-2 rounded-full shrink-0", color)} />;
}

interface TicketTableProps {
  items: MaintenanceTicketItem[];
  isLoading: boolean;
  pageSize: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit: (item: MaintenanceTicketItem) => void;
  onViewDetail: (item: MaintenanceTicketItem) => void;
  onDelete: (item: MaintenanceTicketItem) => void;
}

export function TicketTable({
  items,
  isLoading,
  currentPage,
  totalPages,
  onPageChange,
  onEdit,
  onViewDetail,
  onDelete,
}: TicketTableProps) {
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-6 w-36">Kategori</TableHead>
            <TableHead className="w-36">Assign</TableHead>
            <TableHead>Deskripsi</TableHead>
            <TableHead className="w-32">Estimasi</TableHead>
            <TableHead className="w-36">Status</TableHead>
            <TableHead className="w-32">Diperbarui</TableHead>
            <TableHead className="w-20 text-center">Foto</TableHead>
            <TableHead className="w-12 pr-6" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 8 }).map((__, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : items.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={8}
                className="text-center py-10 text-muted-foreground text-sm"
              >
                Belum ada data maintenance.
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => {
              const assignName =
                item.assignedTo?.fullName ??
                item.assignedTo?.nickName ??
                "—";
              const desc =
                item.description.length > 60
                  ? item.description.slice(0, 60) + "…"
                  : item.description;

              return (
                <TableRow key={item.id}>
                  <TableCell className="px-6 font-medium text-sm">
                    {item.category.name}
                  </TableCell>
                  <TableCell className="text-sm">{assignName}</TableCell>
                  <TableCell className="text-sm">
                    <p className="line-clamp-2 max-w-xs">{desc}</p>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(item.estimateDate)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="flex items-center gap-1.5 w-fit text-xs"
                    >
                      <StatusDot statusName={item.status.name} />
                      {item.status.name}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(item.updatedAt)}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.images.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Gallery weight="BoldDuotone" className="h-3.5 w-3.5" />
                        {item.images.length}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="p-1.5 rounded-md hover:bg-muted"
                          aria-label="Aksi"
                        >
                          <MenuDots
                            weight="BoldDuotone"
                            className="h-4 w-4 text-muted-foreground"
                          />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onViewDetail(item)}>
                          <Eye weight="BoldDuotone" className="h-4 w-4 mr-2" />
                          Lihat Detail
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(item)}>
                          <Pen weight="BoldDuotone" className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDelete(item)}
                          className="text-destructive focus:text-destructive"
                        >
                          <TrashBinTrash weight="BoldDuotone" className="h-4 w-4 mr-2" />
                          Hapus
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      <nav
        aria-label="Navigasi halaman"
        className="flex items-center justify-between px-6 py-4 border-t"
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          disabled={currentPage === 1}
        >
          <ArrowLeft weight="BoldDuotone" className="h-4 w-4 mr-1" />
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Halaman {currentPage} dari {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          disabled={currentPage === totalPages}
        >
          Next
          <ArrowRight weight="BoldDuotone" className="h-4 w-4 ml-1" />
        </Button>
      </nav>
    </>
  );
}
