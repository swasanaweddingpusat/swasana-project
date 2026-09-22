"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AddCircle, Pen, TrashBinTrash, Target, UserRounded, Filter } from "@solar-icons/react";
import { toast } from "sonner";
import { useAssignments, useDeleteAssignment } from "@/hooks/useKpiInsentif";
import { useVenues } from "@/hooks/use-venues";
import { formatRupiah } from "@/lib/utils/kpiFormatters";
import type { KpiAssignmentItem } from "@/types/kpiInsentif";
import { PageHeader } from "@/components/shared/page-header";
import { PenugasanDrawer } from "./PenugasanDrawer";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function periodLabel(date: string): string {
  const value = new Date(date);
  return `${MONTHS[value.getMonth()]} ${value.getFullYear()}`;
}

function periodKey(month: number, year: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function PenugasanClient() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [role, setRole] = useState("all");
  const [venueId, setVenueId] = useState("all");
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editItem, setEditItem] = useState<KpiAssignmentItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { data: venues = [] } = useVenues();
  const { data: assignments = [], isLoading } = useAssignments({ period: periodKey(month, year) });
  const deleteMutation = useDeleteAssignment();

  const filtered = assignments.filter((item) => {
    if (role !== "all" && item.kpiMaster.businessRole !== role) return false;
    if (venueId !== "all" && item.venueId !== venueId) return false;
    return !search.trim() || (item.profile.fullName ?? "").toLowerCase().includes(search.toLowerCase());
  });

  const groups = Array.from(filtered.reduce((map, item) => {
    const key = `${item.profileId}-${item.period}-${item.venueId ?? "all"}`;
    const group = map.get(key) ?? [];
    group.push(item);
    map.set(key, group);
    return map;
  }, new Map<string, KpiAssignmentItem[]>()).values());

  async function handleDelete() {
    if (!deleteId) return;
    const result = await deleteMutation.mutateAsync(deleteId);
    if (result.success) toast.success("Penugasan berhasil dihapus");
    else toast.error(result.error ?? "Gagal menghapus penugasan");
    setDeleteId(null);
  }

  const years = Array.from({ length: 5 }, (_, index) => now.getFullYear() - 2 + index);

  return (
    <>
      <div className="space-y-6">
        <PageHeader title="Penugasan Target KPI" description="Tugaskan KPI ke Sales atau Manager per periode" action={<Button className="rounded-full gap-1.5" onClick={() => { setEditItem(null); setDrawerOpen(true); }}><AddCircle weight="BoldDuotone" className="h-4 w-4" />Tambah Penugasan</Button>} />
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <Filter weight="BoldDuotone" className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Select value={String(month)} onValueChange={(value) => setMonth(Number(value))}><SelectTrigger className="w-36 rounded-full"><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map((label, index) => <SelectItem key={label} value={String(index + 1)}>{label}</SelectItem>)}</SelectContent></Select>
            <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}><SelectTrigger className="w-28 rounded-full"><SelectValue /></SelectTrigger><SelectContent>{years.map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select>
            <Select value={role} onValueChange={setRole}><SelectTrigger className="w-36 rounded-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua Role</SelectItem><SelectItem value="sales">Sales</SelectItem><SelectItem value="manager">Manager</SelectItem></SelectContent></Select>
            <Select value={venueId} onValueChange={setVenueId}><SelectTrigger className="w-36 rounded-full"><SelectValue placeholder="Semua venue" /></SelectTrigger><SelectContent><SelectItem value="all">Semua venue</SelectItem>{venues.map((venue) => <SelectItem key={venue.id} value={venue.id}>{venue.name}</SelectItem>)}</SelectContent></Select>
            <Input type="search" placeholder="Cari nama karyawan..." className="h-8 w-44 rounded-full text-sm" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
        </div>
        {isLoading ? <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">Memuat data...</div> : groups.length === 0 ? <div className="rounded-2xl border bg-card py-16 text-center"><Target weight="BoldDuotone" className="mx-auto h-10 w-10 text-muted-foreground/40" /><p className="mt-3 text-sm text-muted-foreground">Belum ada penugasan untuk periode ini</p><Button variant="outline" size="sm" className="mt-4 rounded-full gap-1.5" onClick={() => { setEditItem(null); setDrawerOpen(true); }}><AddCircle weight="BoldDuotone" className="h-4 w-4" />Tambah Penugasan</Button></div> : <div className="grid gap-4 lg:grid-cols-2">{groups.map((group) => { const first = group[0]; const quantity = group.find((item) => item.kpiMaster.targetItem.indicatorType === "dealing"); const price = group.find((item) => item.kpiMaster.targetItem.indicatorType === "omset"); const homebase = group.find((item) => item.kpiMaster.targetItem.indicatorType === "homebase"); return <div key={`${first.profileId}-${first.period}-${first.venueId ?? "all"}`} className="rounded-2xl border bg-card p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><UserRounded weight="BoldDuotone" className="h-5 w-5 shrink-0 text-muted-foreground" /><div className="min-w-0"><p className="truncate font-semibold">{first.profile.fullName ?? "-"}</p><p className="text-xs text-muted-foreground">{periodLabel(first.period)} · {first.venue?.name ?? "Semua venue"}</p></div></div><Badge variant={group.some((item) => item.isDraft) ? "secondary" : "default"} className="rounded-full">{group.some((item) => item.isDraft) ? "Draft" : "Aktif"}</Badge></div><div className="mt-4 grid grid-cols-3 gap-2">{[{ label: "Jumlah", item: quantity, value: quantity?.targetQty != null ? `${quantity.targetQty} unit` : "Master" }, { label: "Harga", item: price, value: price?.targetPrice != null ? formatRupiah(price.targetPrice) : "Master" }, { label: "Homebase", item: homebase, value: homebase?.targetQty != null ? `${homebase.targetQty} unit` : "Master" }].map(({ label, item, value }) => <div key={label} className="rounded-xl border bg-muted/30 p-3"><p className="text-[11px] font-medium text-muted-foreground">{label}</p><p className="mt-1 truncate text-sm font-semibold">{item ? value : "-"}</p></div>)}</div><div className="mt-4 flex flex-wrap justify-end gap-1 border-t pt-3">{group.map((item) => <div key={item.id} className="flex items-center gap-1"><span className="text-[11px] text-muted-foreground">{item.kpiMaster.targetItem.name}</span><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => { setEditItem(item); setDrawerOpen(true); }}><Pen weight="BoldDuotone" className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" onClick={() => setDeleteId(item.id)}><TrashBinTrash weight="BoldDuotone" className="h-4 w-4" /></Button></div>)}</div></div>; })}</div>}
      </div>
      <PenugasanDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} editItem={editItem} defaultMonth={month} defaultYear={year} />
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hapus Penugasan</AlertDialogTitle><AlertDialogDescription>Yakin ingin menghapus penugasan ini? Tindakan tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="rounded-full">Batal</AlertDialogCancel><AlertDialogAction className="rounded-full" onClick={handleDelete} disabled={deleteMutation.isPending}>{deleteMutation.isPending ? "Menghapus..." : "Ya, Hapus"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );
}
