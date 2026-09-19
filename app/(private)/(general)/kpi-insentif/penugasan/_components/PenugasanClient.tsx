// FILE: app/(private)/(general)/kpi-insentif/penugasan/_components/PenugasanClient.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AddCircle,
  Pen,
  TrashBinTrash,
  Target,
  InfoCircle,
  UserRounded,
  Filter,
} from "@solar-icons/react";
import { toast } from "sonner";
import { useAssignments, useDeleteAssignment } from "@/hooks/useKpiInsentif";
import { useVenues } from "@/hooks/use-venues";
import { formatRupiah } from "@/lib/utils/kpiFormatters";
import type { KpiAssignmentItem } from "@/types/kpiInsentif";
import { PageHeader } from "@/components/shared/page-header";
import { PenugasanDrawer } from "./PenugasanDrawer";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function buildPeriodString(month: number, year: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}

function buildPeriodKey(month: number, year: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function PenugasanClient() {
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterRole, setFilterRole] = useState("all");
  const [filterVenueId, setFilterVenueId] = useState("all");
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editItem, setEditItem] = useState<KpiAssignmentItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: venues = [] } = useVenues();
  const { data: assignments = [], isLoading } = useAssignments({
    period: buildPeriodKey(filterMonth, filterYear),
  });

  const deleteMutation = useDeleteAssignment();

  const filtered = assignments.filter((a) => {
    if (filterRole !== "all" && a.kpiMaster.businessRole !== filterRole) return false;
    if (filterVenueId !== "all" && a.venueId !== filterVenueId) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!(a.profile.fullName ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  async function handleDelete() {
    if (!deleteId) return;
    const res = await deleteMutation.mutateAsync(deleteId);
    if (res.success) {
      toast.success("Penugasan berhasil dihapus");
    } else {
      toast.error(res.error ?? "Gagal menghapus penugasan");
    }
    setDeleteId(null);
  }

  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <PageHeader
          title="Penugasan Target KPI"
          description="Tugaskan KPI ke Sales atau Manager per periode"
          action={
            <Button
              className="rounded-full gap-1.5"
              onClick={() => {
                setEditItem(null);
                setDrawerOpen(true);
              }}
            >
              <AddCircle weight="BoldDuotone" className="h-4 w-4" />
              Tambah Penugasan
            </Button>
          }
        />

        {/* Filter Bar */}
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <Filter weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select
              value={String(filterMonth)}
              onValueChange={(v) => setFilterMonth(Number(v))}
            >
              <SelectTrigger className="rounded-full w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={String(filterYear)}
              onValueChange={(v) => setFilterYear(Number(v))}
            >
              <SelectTrigger className="rounded-full w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="rounded-full w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Role</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterVenueId} onValueChange={setFilterVenueId}>
              <SelectTrigger className="rounded-full w-36">
                <SelectValue placeholder="Semua Venue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Venue</SelectItem>
                {venues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="search"
              placeholder="Cari nama karyawan..."
              className="rounded-full h-8 text-sm w-44"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-semibold">Nama Karyawan</TableHead>
                  <TableHead className="font-semibold">KPI Master</TableHead>
                  <TableHead className="font-semibold">Periode</TableHead>
                  <TableHead className="font-semibold">Venue</TableHead>
                  <TableHead className="font-semibold">Target Override</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      Memuat data...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-40 text-center">
                      <div className="flex flex-col items-center gap-3 py-6">
                        <Target weight="BoldDuotone" className="h-10 w-10 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">Belum ada penugasan untuk periode ini</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full gap-1.5"
                          onClick={() => {
                            setEditItem(null);
                            setDrawerOpen(true);
                          }}
                        >
                          <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                          Tambah Penugasan
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/20 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserRounded weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <p className="font-medium text-sm">{item.profile.fullName ?? "-"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{item.kpiMaster.name}</p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {(() => { const d = new Date(item.period); return buildPeriodString(d.getMonth() + 1, d.getFullYear()); })()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.venue?.name ?? "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.targetQty != null ? (
                          <span>{item.targetQty} unit</span>
                        ) : item.targetPrice != null ? (
                          <span>{formatRupiah(item.targetPrice)}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">Pakai target master</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.isDraft ? (
                          <Tooltip>
                            <TooltipTrigger render={
                              <Badge
                                variant="secondary"
                                className="rounded-full gap-1 cursor-help"
                              >
                                <InfoCircle weight="BoldDuotone" className="h-3 w-3" />
                                Draft
                              </Badge>
                            } />
                            <TooltipContent>
                              {item.kpiMaster.businessRole === "manager"
                                ? "Periode Manager belum dikonfirmasi"
                                : "Penugasan masih dalam tahap draft"}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Badge variant="default" className="rounded-full">Aktif</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full hover:bg-accent"
                            onClick={() => {
                              setEditItem(item);
                              setDrawerOpen(true);
                            }}
                          >
                            <Pen weight="BoldDuotone" className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleteId(item.id)}
                          >
                            <TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <PenugasanDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        editItem={editItem}
        defaultMonth={filterMonth}
        defaultYear={filterYear}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Penugasan</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus penugasan ini? Tindakan tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Batal</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Menghapus..." : "Ya, Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
