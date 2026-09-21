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

  const groupedAssignments = Array.from(
    filtered.reduce((groups, assignment) => {
      const key = `${assignment.profileId}-${assignment.period.toString()}-${assignment.venueId ?? "all"}`;
      const group = groups.get(key) ?? [];
      group.push(assignment);
      groups.set(key, group);
      return groups;
    }, new Map<string, KpiAssignmentItem[]>()).values(),
  );

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
    <>
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

        {/* Grouped assignment cards */}
        {isLoading ? (
          <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">Memuat data...</div>
        ) : groupedAssignments.length === 0 ? (
          <div className="rounded-2xl border bg-card py-16 text-center">
            <Target weight="BoldDuotone" className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">Belum ada penugasan untuk periode ini</p>
            <Button variant="outline" size="sm" className="mt-4 rounded-full gap-1.5" onClick={() => { setEditItem(null); setDrawerOpen(true); }}>
              <AddCircle weight="BoldDuotone" className="h-4 w-4" />
              Tambah Penugasan
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {groupedAssignments.map((group) => {
              const first = group[0];
              const byIndicator = (indicator: string) => group.find((item) => item.kpiMaster.targetItem?.indicatorType === indicator);
              const quantity = byIndicator("dealing");
              const price = byIndicator("omset");
              const homebase = byIndicator("homebase");
              const period = new Date(first.period);
              const hasDraft = group.some((item) => item.isDraft);
              return (
                <div key={`${first.profileId}-${first.period}-${first.venueId ?? "all"}`} className="rounded-2xl border bg-card p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <UserRounded weight="BoldDuotone" className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{first.profile.fullName ?? "-"}</p>
                        <p className="text-xs text-muted-foreground">{buildPeriodString(period.getMonth() + 1, period.getFullYear())} · {first.venue?.name ?? "Semua venue"}</p>
                      </div>
                    </div>
                    {hasDraft ? <Badge variant="secondary" className="rounded-full">Draft</Badge> : <Badge className="rounded-full">Aktif</Badge>}
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[
                      { label: "Jumlah", item: quantity, value: quantity?.targetQty != null ? `${quantity.targetQty} unit` : "Master" },
                      { label: "Harga", item: price, value: price?.targetPrice != null ? formatRupiah(price.targetPrice) : "Master" },
                      { label: "Homebase", item: homebase, value: homebase?.targetQty != null ? `${homebase.targetQty} unit` : "Master" },
                    ].map(({ label, item, value }) => (
                      <div key={label} className="rounded-xl border bg-muted/30 p-3">
                        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
                        <p className="mt-1 truncate text-sm font-semibold">{item ? value : "-"}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-end gap-1 border-t pt-3">
                    {group.map((item) => (
                      <div key={item.id} className="flex items-center gap-1">
                        <span className="text-[11px] text-muted-foreground">{item.kpiMaster.targetItem?.name}</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => { setEditItem(item); setDrawerOpen(true); }}><Pen weight="BoldDuotone" className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(item.id)}><TrashBinTrash weight="BoldDuotone" className="h-4 w-4" /></Button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
    </>
  );
}
