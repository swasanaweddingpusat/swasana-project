"use client";

import { useState, useTransition, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Drawer } from "@/components/shared/drawer";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Crown, TrendingUp, TrendingDown, Target, Users, DollarSign, CalendarCheck,
  Plus, Settings, MoreHorizontal, PenLine, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SalesDetailModal } from "./sales-detail-drawer";
import {
  updateMyTeamSettings,
  addMyTeamMember,
  removeMyTeamMember,
  setMemberTarget,
} from "@/actions/my-team";
import type { MyTeamGroup, MyTeamPerformanceItem, AvailableSalesProfile } from "@/lib/queries/my-team";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  group: NonNullable<MyTeamGroup>;
  initialPerformance: MyTeamPerformanceItem[];
  availableProfiles: AvailableSalesProfile[];
  currentProfileId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRp(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}jt`;
  return n.toLocaleString("id-ID");
}

function formatFull(n: number) {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function achievementPct(actual: number, target: number) {
  if (target === 0) return 0;
  return Math.round((actual / target) * 100);
}

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

// ─── Component ────────────────────────────────────────────────────────────────

export function MyTeamClient({ group, initialPerformance, availableProfiles, currentProfileId }: Props) {
  const [isPending, startTransition] = useTransition();

  // Period filter
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth());
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const periodLabel = `${MONTHS[filterMonth]} ${filterYear}`;

  // Fetch performance data — refetches when period changes
  const { startDate, endDate } = useMemo(() => {
    const s = new Date(filterYear, filterMonth, 1);
    const e = new Date(filterYear, filterMonth + 1, 0, 23, 59, 59);
    return { startDate: s.toISOString(), endDate: e.toISOString() };
  }, [filterMonth, filterYear]);

  const { data: performance = initialPerformance } = useQuery<MyTeamPerformanceItem[]>({
    queryKey: ["my-team-performance", group.id, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ groupId: group.id, startDate, endDate });
      const res = await fetch(`/api/my-team/performance?${params}`);
      if (!res.ok) return initialPerformance;
      return res.json();
    },
    initialData: initialPerformance,
    staleTime: 60_000,
  });

  // Team settings drawer
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [teamName, setTeamName] = useState(group.name);
  const [teamDesc, setTeamDesc] = useState(group.description ?? "");

  // Add member dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");

  // Edit target dialog
  type MemberRow = { profileId: string; name: string; target: number };
  const [editTargetMember, setEditTargetMember] = useState<MemberRow | null>(null);
  const [targetInput, setTargetInput] = useState("");
  const [targetFrom, setTargetFrom] = useState("");
  const [targetTo, setTargetTo] = useState("");

  // Sales detail drawer
  const [detailMemberId, setDetailMemberId] = useState<string | null>(null);

  // Delete confirm
  const [deleteMember, setDeleteMember] = useState<MemberRow | null>(null);

  // Build member rows — merge group.members + performance
  const memberRows = group.members.map((m) => {
    const perf = performance.find((p) => p.profileId === m.userId);
    return {
      profileId: m.userId,
      name: m.profile.fullName ?? m.userId,
      avatarUrl: m.profile.avatarUrl ?? undefined,
      target: perf?.target ?? 0,
      actual: perf?.actual ?? 0,
      bookings: perf?.bookings ?? 0,
      confirmed: perf?.confirmed ?? 0,
      pendingApproval: perf?.pendingApproval ?? 0,
    };
  });

  const sorted = [...memberRows].sort((a, b) => b.actual - a.actual);

  const totalSales = memberRows.reduce((s, m) => s + m.actual, 0);
  const totalTarget = memberRows.reduce((s, m) => s + m.target, 0);
  const totalBookings = memberRows.reduce((s, m) => s + m.bookings, 0);
  const totalConfirmed = memberRows.reduce((s, m) => s + m.confirmed, 0);
  const overallPct = achievementPct(totalSales, totalTarget);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  function handleSaveSettings() {
    startTransition(async () => {
      const res = await updateMyTeamSettings({ id: group.id, name: teamName, description: teamDesc });
      if (res.success) {
        toast.success("Pengaturan tim disimpan");
        setSettingsOpen(false);
      } else {
        toast.error(res.error ?? "Terjadi kesalahan");
      }
    });
  }

  function handleAddMember(profileId: string) {
    startTransition(async () => {
      const res = await addMyTeamMember(group.id, profileId);
      if (res.success) {
        toast.success("Anggota berhasil ditambahkan");
        setAddOpen(false);
      } else {
        toast.error(res.error ?? "Terjadi kesalahan");
      }
    });
  }

  function handleRemoveMember() {
    if (!deleteMember) return;
    startTransition(async () => {
      const res = await removeMyTeamMember(group.id, deleteMember.profileId);
      if (res.success) {
        toast.success(`${deleteMember.name} dihapus dari tim`);
        setDeleteMember(null);
      } else {
        toast.error(res.error ?? "Terjadi kesalahan");
      }
    });
  }

  function handleSaveTarget() {
    if (!editTargetMember) return;
    startTransition(async () => {
      const res = await setMemberTarget({
        groupId: group.id,
        profileId: editTargetMember.profileId,
        amount: Number(targetInput) || 0,
        startDate: targetFrom,
        endDate: targetTo,
      });
      if (res.success) {
        toast.success("Target berhasil disimpan");
        setEditTargetMember(null);
      } else {
        toast.error(res.error ?? "Terjadi kesalahan");
      }
    });
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Team Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-foreground">{teamName}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{teamDesc}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Select value={filterMonth.toString()} onValueChange={(v) => setFilterMonth(Number(v))}>
              <SelectTrigger className="h-8 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={i.toString()}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterYear.toString()} onValueChange={(v) => setFilterYear(Number(v))}>
              <SelectTrigger className="h-8 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-3.5 w-3.5" /> Pengaturan
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <OverviewCard icon={DollarSign} label="Total Penjualan" value={formatRp(totalSales)} sub={`dari target ${formatRp(totalTarget)}`} />
        <OverviewCard icon={Target} label="Achievement" value={`${overallPct}%`} sub={overallPct >= 80 ? "On track" : "Below target"} accent={overallPct >= 80} />
        <OverviewCard icon={CalendarCheck} label="Booking Confirmed" value={`${totalConfirmed}`} sub={`dari ${totalBookings} total booking`} />
        <OverviewCard icon={Users} label="Anggota Tim" value={`${memberRows.length}`} sub="Sales aktif" />
      </div>

      {/* Sales Performance Table */}
      <Card className="shadow-none p-0">
        <CardContent className="p-0">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-foreground">Sales Performance</span>
              <Badge variant="secondary" className="text-xs">{periodLabel}</Badge>
            </div>
            <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Tambah Sales
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="border-b-2 border-border bg-secondary">
                <TableHead className="px-6 py-2.5 font-semibold text-muted-foreground text-xs w-14">Rank</TableHead>
                <TableHead className="px-2 py-2.5 font-semibold text-muted-foreground text-xs">Sales</TableHead>
                <TableHead className="px-2 py-2.5 font-semibold text-muted-foreground text-xs text-right">Target</TableHead>
                <TableHead className="px-2 py-2.5 font-semibold text-muted-foreground text-xs text-right">Penjualan</TableHead>
                <TableHead className="px-2 py-2.5 font-semibold text-muted-foreground text-xs text-center">Achievement</TableHead>
                <TableHead className="px-2 py-2.5 font-semibold text-muted-foreground text-xs text-center">Trend</TableHead>
                <TableHead className="px-2 py-2.5 font-semibold text-muted-foreground text-xs w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((member, idx) => {
                const rank = idx + 1;
                const isTop = rank === 1;
                const pctVal = achievementPct(member.actual, member.target);
                const overTarget = member.actual >= member.target && member.target > 0;

                return (
                  <TableRow
                    key={member.profileId}
                    className={cn(
                      "border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer",
                      isTop && "bg-primary/[0.03]"
                    )}
                    onClick={() => setDetailMemberId(member.profileId)}
                  >
                    <TableCell className="px-6 py-3">
                      <div className="flex items-center justify-center">
                        {isTop ? (
                          <Crown className="h-5 w-5 text-foreground" />
                        ) : (
                          <span className={cn(
                            "text-sm font-semibold w-6 h-6 rounded-full flex items-center justify-center",
                            rank <= 3 ? "bg-secondary text-foreground" : "text-muted-foreground"
                          )}>{rank}</span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="px-2 py-3">
                      <div className="flex items-center gap-2.5">
                        <ProfileAvatar name={member.name} src={member.avatarUrl ?? undefined} size="sm" />
                        <div>
                          <span className={cn("text-sm font-medium", isTop && "font-semibold")}>{member.name}</span>
                          {isTop && (
                            <span className="ml-2 text-[10px] font-semibold text-primary-foreground bg-primary px-1.5 py-0.5 rounded-full">Top Performer</span>
                          )}
                          {member.pendingApproval > 0 && (
                            <span className="ml-2 text-[10px] font-medium text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full">
                              {member.pendingApproval} Pending Approval
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="px-2 py-3 text-right">
                      <span className="text-xs text-muted-foreground">
                        {member.target > 0 ? formatFull(member.target) : "—"}
                      </span>
                    </TableCell>

                    <TableCell className="px-2 py-3 text-right">
                      <span className={cn("text-sm font-semibold", overTarget ? "text-foreground" : "text-muted-foreground")}>
                        {formatFull(member.actual)}
                      </span>
                    </TableCell>

                    <TableCell className="px-2 py-3">
                      <div className="flex flex-col items-center gap-1">
                        <span className={cn(
                          "text-xs font-semibold",
                          pctVal >= 100 ? "text-foreground" : pctVal >= 70 ? "text-muted-foreground" : "text-destructive"
                        )}>{pctVal}%</span>
                        <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              pctVal >= 100 ? "bg-primary" : pctVal >= 70 ? "bg-muted-foreground" : "bg-destructive"
                            )}
                            style={{ width: `${Math.min(pctVal, 100)}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="px-2 py-3 text-center">
                      {overTarget ? (
                        <TrendingUp className="h-4 w-4 text-foreground mx-auto" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-muted-foreground mx-auto" />
                      )}
                    </TableCell>

                    <TableCell className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="p-1 hover:bg-secondary rounded cursor-pointer outline-none">
                          <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setEditTargetMember({ profileId: member.profileId, name: member.name, target: member.target });
                            setTargetInput(member.target.toString());
                            setTargetFrom("");
                            setTargetTo("");
                          }}>
                            <PenLine className="h-3.5 w-3.5 mr-2" /> Edit Target
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteMember({ profileId: member.profileId, name: member.name, target: member.target })}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Hapus dari Tim
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Sales Detail Modal */}
      <SalesDetailModal
        memberId={detailMemberId}
        memberName={sorted.find((m) => m.profileId === detailMemberId)?.name ?? ""}
        memberAvatarUrl={sorted.find((m) => m.profileId === detailMemberId)?.avatarUrl ?? null}
        memberTarget={sorted.find((m) => m.profileId === detailMemberId)?.target ?? 0}
        memberActual={sorted.find((m) => m.profileId === detailMemberId)?.actual ?? 0}
        filterMonth={filterMonth}
        filterYear={filterYear}
        onClose={() => setDetailMemberId(null)}
      />

      {/* Team Settings Drawer */}
      <Drawer isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} title="Pengaturan Team">
        <div className="flex flex-col justify-between h-full">
          <div className="space-y-4 px-2">
            <div>
              <Label className="text-sm font-medium">Nama Team</Label>
              <Input className="mt-1" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Nama team" />
            </div>
            <div>
              <Label className="text-sm font-medium">Deskripsi</Label>
              <Textarea className="mt-1" value={teamDesc} onChange={(e) => setTeamDesc(e.target.value)} placeholder="Deskripsi team" rows={3} />
            </div>
          </div>
          <div className="sticky bottom-0 bg-white z-10">
            <div className="flex py-4 gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setSettingsOpen(false)}>Batal</Button>
              <Button className="flex-1" disabled={isPending} onClick={handleSaveSettings}>Simpan</Button>
            </div>
          </div>
        </div>
      </Drawer>

      {/* Add Member Dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setAddSearch(""); }}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Tambah Anggota</DialogTitle>
          <div className="mt-2 space-y-2">
            <Input
              placeholder="Cari sales..."
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
              autoFocus
            />
            <ScrollArea className="h-52 rounded-md border">
              <div className="p-1">
                {availableProfiles
                  .filter((p) => (p.fullName ?? "").toLowerCase().includes(addSearch.toLowerCase()))
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={isPending}
                      onClick={() => handleAddMember(p.id)}
                      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-sm text-sm hover:bg-accent text-left cursor-pointer disabled:opacity-50"
                    >
                      <ProfileAvatar name={p.fullName ?? p.id} src={p.avatarUrl ?? undefined} size="sm" />
                      <span>{p.fullName ?? p.id}</span>
                    </button>
                  ))}
                {availableProfiles.filter((p) => (p.fullName ?? "").toLowerCase().includes(addSearch.toLowerCase())).length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">Tidak ada sales tersedia</p>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Target Dialog */}
      <Dialog open={!!editTargetMember} onOpenChange={(open) => { if (!open) setEditTargetMember(null); }}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Edit Target — {editTargetMember?.name}</DialogTitle>
          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-sm">Periode</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input type="date" className="flex-1" value={targetFrom} onChange={(e) => setTargetFrom(e.target.value)} />
                <span className="text-xs text-muted-foreground">s/d</span>
                <Input type="date" className="flex-1" value={targetTo} onChange={(e) => setTargetTo(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-sm">Target Penjualan</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
                <Input
                  type="text"
                  className="pl-9"
                  value={targetInput ? Number(targetInput).toLocaleString("id-ID") : ""}
                  onChange={(e) => setTargetInput(e.target.value.replace(/\D/g, ""))}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setEditTargetMember(null)}>Batal</Button>
            <Button className="flex-1" disabled={isPending || !targetFrom || !targetTo} onClick={handleSaveTarget}>Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteMember}
        onOpenChange={(open) => { if (!open) setDeleteMember(null); }}
        title="Hapus dari Tim"
        description={`Yakin ingin menghapus ${deleteMember?.name ?? ""} dari tim ini?`}
        confirmLabel="Hapus"
        onConfirm={handleRemoveMember}
      />
    </div>
  );
}

// ─── Overview Card ────────────────────────────────────────────────────────────

function OverviewCard({ icon: Icon, label, value, sub, accent }: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center justify-center h-9 w-9 rounded-lg shrink-0",
            accent ? "bg-primary text-primary-foreground" : "bg-secondary"
          )}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
            <p className="text-[11px] text-muted-foreground">{sub}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
