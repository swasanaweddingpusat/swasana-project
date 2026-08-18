"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AddCircle,
  DownloadMinimalistic,
  Magnifer,
  Eye,
  Pen,
  TrashBinTrash,
} from "@solar-icons/react";
import { toast } from "sonner";
import { useAnnouncements, useDeleteAnnouncement } from "@/hooks/use-announcements";
import { AnnouncementCreateDialog } from "./AnnouncementCreateDialog";

function formatDate(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === "high") {
    return (
      <Badge className="rounded-full text-xs bg-destructive/10 text-destructive border-0">
        High
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="rounded-full text-xs">
      Normal
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "published") {
    return (
      <Badge className="rounded-full text-xs bg-primary/10 text-primary border-0">
        Published
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="rounded-full text-xs">
      Draft
    </Badge>
  );
}

export function AnnouncementClient() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: announcements, isLoading } = useAnnouncements();
  const deleteMutation = useDeleteAnnouncement();

  const filtered = (announcements ?? []).filter((a) => {
    const term = search.toLowerCase();
    return (
      a.title.toLowerCase().includes(term) ||
      (a.category ?? "").toLowerCase().includes(term) ||
      (a.createdBy.fullName ?? "").toLowerCase().includes(term)
    );
  });

  const displayed = filtered.slice(0, pageSize);

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-heading font-bold text-foreground">
            Announcement
          </h1>
          <p className="text-sm text-muted-foreground">
            Kelola pengumuman resmi perusahaan untuk seluruh karyawan
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" className="rounded-full gap-2">
            <DownloadMinimalistic weight="BoldDuotone" className="h-4 w-4" />
            Export
          </Button>
          <Button className="rounded-full gap-2" onClick={() => setDialogOpen(true)}>
            <AddCircle weight="BoldDuotone" className="h-4 w-4" />
            Tambah Data
          </Button>
        </div>
      </div>

      {/* Filters + Table Card */}
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-0">
          {/* Filter bar */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                Show
              </span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => setPageSize(Number(v))}
              >
                <SelectTrigger className="rounded-full h-8 w-20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                entries
              </span>
            </div>

            <div className="relative w-60">
              <Magnifer
                weight="BoldDuotone"
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              />
              <Input
                placeholder="Cari pengumuman..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 rounded-full h-8 text-sm"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">NO</TableHead>
                  <TableHead>JUDUL</TableHead>
                  <TableHead>KATEGORI</TableHead>
                  <TableHead>PENULIS</TableHead>
                  <TableHead>TANGGAL</TableHead>
                  <TableHead>PRIORITAS</TableHead>
                  <TableHead>STATUS</TableHead>
                  <TableHead className="text-right pr-4">ACTION</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-6" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : displayed.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-16 text-center text-muted-foreground"
                    >
                      Tidak ada data pengumuman ditemukan
                    </TableCell>
                  </TableRow>
                ) : (
                  displayed.map((announcement, index) => (
                    <TableRow
                      key={announcement.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {announcement.title}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {announcement.category ?? "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {announcement.createdBy.fullName ?? "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {announcement.publishedAt
                          ? formatDate(announcement.publishedAt)
                          : formatDate(announcement.createdAt)}
                      </TableCell>
                      <TableCell>
                        <PriorityBadge priority={announcement.priority} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={announcement.status} />
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            onClick={() => router.push(`/announcement/${announcement.id}`)}
                          >
                            <Eye weight="BoldDuotone" className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                          >
                            <Pen weight="BoldDuotone" className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm("Yakin hapus pengumuman ini?")) {
                                deleteMutation.mutate(announcement.id, {
                                  onSuccess: (res) => {
                                    if (res.success) {
                                      toast.success("Pengumuman berhasil dihapus");
                                    } else {
                                      toast.error(res.error ?? "Gagal menghapus pengumuman");
                                    }
                                  },
                                });
                              }
                            }}
                          >
                            <TrashBinTrash
                              weight="BoldDuotone"
                              className="h-4 w-4"
                            />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t">
            <p className="text-xs text-muted-foreground">
              Showing 1 to {displayed.length} of {filtered.length} entries
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full text-xs h-8 px-4"
                disabled
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full text-xs h-8 px-4"
                disabled
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AnnouncementCreateDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
