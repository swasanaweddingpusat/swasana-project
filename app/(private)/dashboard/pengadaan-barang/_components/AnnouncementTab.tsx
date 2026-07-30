"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { AnnouncementFormDrawer } from "./AnnouncementFormDrawer";
import { Pen, TrashBinTrash, MenuDots, BellBing } from "@solar-icons/react";
import {
  useAnnouncementList,
  useDeleteAnnouncement,
} from "@/hooks/useProcurement";
import type { AnnouncementItem } from "@/lib/queries/procurement";

const SHORT_INDONESIAN_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const parsed = new Date(date);
  const day = parsed.getDate();
  const month = SHORT_INDONESIAN_MONTHS[parsed.getMonth()] ?? "";
  const year = parsed.getFullYear();
  return `${day} ${month} ${year}`;
}

const TARGET_AUDIENCE_LABEL: Record<string, string> = {
  ALL: "Semua",
  VENUE: "Per Venue",
  DIVISION: "Per Divisi",
};

interface AnnouncementTabProps {
  venues: { id: string; name: string }[];
  addTrigger?: number;
}

export function AnnouncementTab({ venues, addTrigger = 0 }: AnnouncementTabProps): React.JSX.Element {
  const [page, setPage] = useState(1);
  const limit = 20;

  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<AnnouncementItem | null>(null);

  const prevTrigger = useRef(addTrigger);
  useEffect(() => {
    if (addTrigger > prevTrigger.current) {
      setEditItem(null);
      setFormOpen(true);
    }
    prevTrigger.current = addTrigger;
  }, [addTrigger]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useAnnouncementList(page, limit);
  const { mutateAsync: deleteMutation, isPending: isDeleting } = useDeleteAnnouncement();

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  function handleEditClick(item: AnnouncementItem): void {
    setEditItem(item);
    setFormOpen(true);
  }

  function handleFormOpenChange(open: boolean): void {
    setFormOpen(open);
    if (!open) setEditItem(null);
  }

  async function handleDelete(): Promise<void> {
    if (!deleteId) return;
    try {
      await deleteMutation(deleteId);
      toast.success("Pengumuman berhasil dihapus.");
      setDeleteId(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menghapus pengumuman"
      );
    }
  }

  const deleteItem = deleteId ? items.find((i) => i.id === deleteId) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <BellBing weight="BoldDuotone" className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-heading font-semibold text-foreground">
            Pengumuman
          </h2>
          <p className="text-xs text-muted-foreground">
            Kelola pengumuman untuk tim pengadaan
          </p>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat memuat data pengumuman."}
        </div>
      )}

      {/* Table card */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">Judul</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dibuat Oleh</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead className="w-12 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={idx}>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell />
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                    <BellBing weight="BoldDuotone" className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      Belum ada pengumuman. Klik tombol di atas untuk menambahkan.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  {/* Judul + preview content */}
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-foreground line-clamp-1">
                        {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {item.content}
                      </p>
                    </div>
                  </TableCell>

                  {/* Target */}
                  <TableCell>
                    <div className="space-y-0.5">
                      <span className="text-xs font-medium text-foreground">
                        {TARGET_AUDIENCE_LABEL[item.targetAudience] ?? item.targetAudience}
                      </span>
                      {item.targetList.length > 0 && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {item.targetList.join(", ")}
                        </p>
                      )}
                    </div>
                  </TableCell>

                  {/* Status badge */}
                  <TableCell>
                    {item.isActive ? (
                      <Badge className="rounded-full bg-primary/10 text-primary border-0 text-xs font-medium">
                        Aktif
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="rounded-full text-xs font-medium text-muted-foreground"
                      >
                        Nonaktif
                      </Badge>
                    )}
                  </TableCell>

                  {/* Created by */}
                  <TableCell>
                    <span className="text-sm text-foreground">
                      {item.createdBy.fullName}
                    </span>
                  </TableCell>

                  {/* Date */}
                  <TableCell>
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(item.createdAt)}
                    </span>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          aria-label="Aksi"
                        >
                          <MenuDots weight="BoldDuotone" className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => handleEditClick(item)}
                          className="flex items-center gap-2"
                        >
                          <Pen weight="BoldDuotone" className="h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => setDeleteId(item.id)}
                          className="flex items-center gap-2 text-destructive focus:text-destructive"
                        >
                          <TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />
                          Hapus
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {totalPages > 1 && (
          <PaginationBar
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            label="Navigasi halaman pengumuman"
          />
        )}
      </div>

      {/* Form Drawer */}
      <AnnouncementFormDrawer
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        item={editItem}
        venues={venues}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => {
          if (!o) setDeleteId(null);
        }}
        title="Hapus Pengumuman"
        description={
          deleteItem
            ? `Hapus pengumuman "${deleteItem.title}"? Tindakan ini tidak dapat dibatalkan.`
            : "Hapus pengumuman ini? Tindakan ini tidak dapat dibatalkan."
        }
        confirmLabel={isDeleting ? "Menghapus..." : "Hapus"}
        cancelLabel="Batal"
        onConfirm={() => {
          void handleDelete();
        }}
        destructive
      />
    </div>
  );
}
