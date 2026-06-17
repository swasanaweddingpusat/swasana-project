"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Drawer } from "@/components/shared/drawer";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  UsersGroupRounded,
  Dollar,
  CalendarMark,
  Settings,
  UserCircle,
} from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ChangeLeaderDialog } from "./ChangeLeaderDialog";
import { GroupSalesMasterDetail } from "./GroupSalesMasterDetail";
import type { SalesListMember } from "./GroupSalesListItem";
import {
  useUpdateGroup,
  useAddGroupMember,
  useRemoveGroupMember,
  useSetMemberTarget,
} from "@/hooks/use-groups";
import type {
  GroupDetail,
  GroupPerformanceItem,
  AvailableSalesProfile,
  EligibleLeader,
} from "@/lib/queries/groups";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  group: NonNullable<GroupDetail>;
  initialPerformance: GroupPerformanceItem[];
  availableProfiles: AvailableSalesProfile[];
  eligibleLeaders: EligibleLeader[];
  currentProfileId: string;
  canManage: boolean;
  isSuperAdmin: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRp(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}jt`;
  return n.toLocaleString("id-ID");
}

function achievementPct(actual: number, target: number) {
  if (target === 0) return 0;
  return Math.round((actual / target) * 100);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GroupDetailClient({
  group,
  initialPerformance,
  availableProfiles,
  eligibleLeaders,
  currentProfileId: _currentProfileId,
  canManage,
  isSuperAdmin,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const updateGroupMutation = useUpdateGroup();
  const addMemberMutation = useAddGroupMember();
  const removeMemberMutation = useRemoveGroupMember();
  const setTargetMutation = useSetMemberTarget();

  const isPending =
    updateGroupMutation.isPending ||
    addMemberMutation.isPending ||
    removeMemberMutation.isPending ||
    setTargetMutation.isPending;

  const { data: performance = initialPerformance } = useQuery<GroupPerformanceItem[]>({
    queryKey: ["groups", "performance", group.id],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${group.id}/performance`);
      if (!res.ok) return initialPerformance;
      return res.json() as Promise<GroupPerformanceItem[]>;
    },
    initialData: initialPerformance,
    staleTime: 60_000,
  });

  // ── Dialog state ─────────────────────────────────────────────────────────────

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [teamName, setTeamName] = useState(group.name);
  const [teamDesc, setTeamDesc] = useState(group.description ?? "");
  const [addOpen, setAddOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [changeLeaderOpen, setChangeLeaderOpen] = useState(false);

  type MemberRow = { profileId: string; name: string; target: number };
  const [editTargetMember, setEditTargetMember] = useState<MemberRow | null>(null);
  const [targetInput, setTargetInput] = useState("");

  const [deleteMember, setDeleteMember] = useState<MemberRow | null>(null);

  // Master-detail selection state
  const [selectedSalesId, setSelectedSalesId] = useState<string | null>(null);

  // ── Local members mirror ───────────────────────────────────────────────────
  // The list, the member counter, and the hero all read from `members`. We mirror
  // the server prop into local state so add/remove reflect instantly (optimistic),
  // then re-sync whenever the server prop changes (after router.refresh() lands).
  // Reset-on-prop-change is done during render (React's "adjust state while rendering"
  // pattern) instead of an effect, so there is no extra render pass.
  type GroupMember = Props["group"]["members"][number];
  const [members, setMembers] = useState<GroupMember[]>(group.members);
  const [syncedMembers, setSyncedMembers] = useState(group.members);
  if (syncedMembers !== group.members) {
    setSyncedMembers(group.members);
    setMembers(group.members);
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  const memberRows = members.map((m) => {
    const perf = performance.find((p) => p.profileId === m.userId);
    return {
      profileId: m.userId,
      name: m.profile.fullName ?? m.userId,
      email: m.profile.email ?? null,
      roleName: m.profile.role?.name ?? null,
      avatarUrl: m.profile.avatarUrl ?? undefined,
      target: perf?.target ?? 0,
      actual: perf?.actual ?? 0,
      bookings: perf?.bookings ?? 0,
      confirmed: perf?.confirmed ?? 0,
      pendingApproval: perf?.pendingApproval ?? 0,
    };
  });

  const sorted = [...memberRows].sort((a, b) => b.actual - a.actual);

  // SalesListMember shape (with rank)
  const salesListMembers: SalesListMember[] = sorted.map((m, idx) => ({
    ...m,
    rank: idx + 1,
  }));

  const totalSales = memberRows.reduce((s, m) => s + m.actual, 0);
  const totalTarget = memberRows.reduce((s, m) => s + m.target, 0);
  const totalBookings = memberRows.reduce((s, m) => s + m.bookings, 0);
  const totalConfirmed = memberRows.reduce((s, m) => s + m.confirmed, 0);
  const overallPct = achievementPct(totalSales, totalTarget);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleSaveSettings() {
    updateGroupMutation.mutate(
      { id: group.id, name: teamName, description: teamDesc },
      {
        onSuccess: (res) => {
          if (res.success) {
            toast.success("Pengaturan grup disimpan");
            setSettingsOpen(false);
            router.refresh();
          } else {
            toast.error(res.error ?? "Terjadi kesalahan");
          }
        },
      },
    );
  }

  function handleAddMember(profileId: string) {
    const profile = availableProfiles.find((p) => p.id === profileId);
    addMemberMutation.mutate(
      { groupId: group.id, userId: profileId },
      {
        onSuccess: (res) => {
          if (res.success) {
            toast.success("Anggota berhasil ditambahkan");
            setAddOpen(false);
            // Optimistic: show the new member immediately, then re-sync from the server
            // prop once router.refresh() lands.
            if (profile) {
              setMembers((prev) =>
                prev.some((m) => m.userId === profileId)
                  ? prev
                  : [
                      ...prev,
                      {
                        userId: profile.id,
                        profile: {
                          id: profile.id,
                          fullName: profile.fullName,
                          email: profile.email,
                          avatarUrl: profile.avatarUrl,
                          role: null,
                        },
                      } as GroupMember,
                    ],
              );
            }
            void queryClient.invalidateQueries({ queryKey: ["groups", "performance", group.id] });
            router.refresh();
          } else {
            toast.error(res.error ?? "Terjadi kesalahan");
          }
        },
      },
    );
  }

  function handleRemoveMember() {
    if (!deleteMember) return;
    removeMemberMutation.mutate(
      { groupId: group.id, userId: deleteMember.profileId },
      {
        onSuccess: (res) => {
          if (res.success) {
            toast.success(`${deleteMember.name} dihapus dari grup`);
            const removedId = deleteMember.profileId;
            setDeleteMember(null);
            // Optimistic: drop the member immediately; the server prop re-syncs after refresh.
            setMembers((prev) => prev.filter((m) => m.userId !== removedId));
            if (selectedSalesId === removedId) setSelectedSalesId(null);
            void queryClient.invalidateQueries({ queryKey: ["groups", "performance", group.id] });
            router.refresh();
          } else {
            toast.error(res.error ?? "Terjadi kesalahan");
          }
        },
      },
    );
  }

  function handleSaveTarget() {
    if (!editTargetMember) return;
    setTargetMutation.mutate(
      {
        groupId: group.id,
        profileId: editTargetMember.profileId,
        amount: Number(targetInput) || 0,
      },
      {
        onSuccess: (res) => {
          if (res.success) {
            toast.success("Target berhasil disimpan");
            setEditTargetMember(null);
            void queryClient.invalidateQueries({ queryKey: ["groups", "performance", group.id] });
            router.refresh();
          } else {
            toast.error(res.error ?? "Terjadi kesalahan");
          }
        },
      },
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Breadcrumb + actions — single row, team name lives in the breadcrumb */}
      <div className="flex items-center justify-between gap-3">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href="/dashboard/groups" />}>
                Groups
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{teamName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center gap-1 shrink-0">
          {isSuperAdmin && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setChangeLeaderOpen(true)}
              aria-label="Ganti Leader"
              title="Ganti Leader"
            >
              <UserCircle weight="BoldDuotone" className="h-4 w-4" />
            </Button>
          )}
          {canManage && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setSettingsOpen(true)}
              aria-label="Pengaturan Grup"
              title="Pengaturan Grup"
            >
              <Settings weight="BoldDuotone" className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Team Pace — hero: achievement ring (gold) + supporting stats */}
      <TeamPaceHero
        pct={overallPct}
        totalSales={totalSales}
        totalTarget={totalTarget}
        totalConfirmed={totalConfirmed}
        totalBookings={totalBookings}
        memberCount={memberRows.length}
      />

      {/* Master-Detail split view */}
      <GroupSalesMasterDetail
        members={salesListMembers}
        canManage={canManage}
        selectedSalesId={selectedSalesId}
        onSelectSales={setSelectedSalesId}
        onAddMember={() => setAddOpen(true)}
        onEditTarget={(member) => {
          setEditTargetMember({
            profileId: member.profileId,
            name: member.name,
            target: member.target,
          });
          setTargetInput(member.target.toString());
        }}
        onRemoveMember={(member) =>
          setDeleteMember({
            profileId: member.profileId,
            name: member.name,
            target: member.target,
          })
        }
      />

      {/* Change Leader Dialog */}
      {isSuperAdmin && (
        <ChangeLeaderDialog
          open={changeLeaderOpen}
          onOpenChange={setChangeLeaderOpen}
          group={group}
          eligibleLeaders={eligibleLeaders}
        />
      )}

      {/* Settings Drawer */}
      {canManage && (
        <Drawer isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} title="Pengaturan Grup">
          <div className="flex flex-col justify-between h-full">
            <div className="space-y-4 px-2">
              <div>
                <Label htmlFor="settings-group-name" className="text-sm font-medium">Nama Grup</Label>
                <Input
                  id="settings-group-name"
                  className="mt-1 text-base sm:text-sm"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Nama grup"
                />
              </div>
              <div>
                <Label htmlFor="settings-group-desc" className="text-sm font-medium">Deskripsi</Label>
                <Textarea
                  id="settings-group-desc"
                  className="mt-1 text-base sm:text-sm"
                  value={teamDesc}
                  onChange={(e) => setTeamDesc(e.target.value)}
                  placeholder="Deskripsi grup"
                  rows={3}
                />
              </div>
            </div>
            <div className="sticky bottom-0 bg-background z-10">
              <div className="flex py-4 gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setSettingsOpen(false)}>
                  Batal
                </Button>
                <Button className="flex-1" disabled={isPending} onClick={handleSaveSettings}>
                  Simpan
                </Button>
              </div>
            </div>
          </div>
        </Drawer>
      )}

      {/* Add Member Dialog */}
      {canManage && (
        <Dialog
          open={addOpen}
          onOpenChange={(o) => {
            setAddOpen(o);
            if (!o) setAddSearch("");
          }}
        >
          <DialogContent className="w-[calc(100vw-2rem)] max-w-sm max-h-[90vh] overflow-y-auto">
            <DialogTitle>Tambah Anggota</DialogTitle>
            <div className="mt-2 space-y-2">
              <Input
                placeholder="Cari sales..."
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                className="text-base sm:text-sm"
                autoFocus
              />
              <ScrollArea className="h-52 rounded-md border">
                <div className="p-1">
                  {availableProfiles
                    .filter((p) =>
                      (p.fullName ?? "").toLowerCase().includes(addSearch.toLowerCase()),
                    )
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        disabled={isPending}
                        onClick={() => handleAddMember(p.id)}
                        className="w-full flex items-center gap-2.5 px-2 py-2 rounded-sm text-sm hover:bg-accent text-left cursor-pointer disabled:opacity-50"
                      >
                        <ProfileAvatar
                          name={p.fullName ?? p.id}
                          src={p.avatarUrl ?? undefined}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-foreground">{p.fullName ?? p.id}</p>
                          {p.email && (
                            <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  {availableProfiles.filter((p) =>
                    (p.fullName ?? "").toLowerCase().includes(addSearch.toLowerCase()),
                  ).length === 0 && (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      Tidak ada sales tersedia
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Target Dialog */}
      {canManage && (
        <Dialog
          open={!!editTargetMember}
          onOpenChange={(open) => {
            if (!open) setEditTargetMember(null);
          }}
        >
          <DialogContent className="w-[calc(100vw-2rem)] max-w-sm max-h-[90vh] overflow-y-auto">
            <DialogTitle>Edit Target — {editTargetMember?.name}</DialogTitle>
            <div className="space-y-3 mt-2">
              <div>
                <Label htmlFor="target-amount" className="text-sm">Target Penjualan</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    Rp
                  </span>
                  <Input
                    id="target-amount"
                    type="text"
                    className="pl-9 text-base sm:text-sm"
                    value={targetInput ? Number(targetInput).toLocaleString("id-ID") : ""}
                    onChange={(e) => setTargetInput(e.target.value.replace(/\D/g, ""))}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setEditTargetMember(null)}
              >
                Batal
              </Button>
              <Button
                className="flex-1"
                disabled={isPending}
                onClick={handleSaveTarget}
              >
                Simpan
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Remove Member Confirm */}
      {canManage && (
        <ConfirmDialog
          open={!!deleteMember}
          onOpenChange={(open) => {
            if (!open) setDeleteMember(null);
          }}
          title="Hapus dari Grup"
          description={`Yakin ingin menghapus ${deleteMember?.name ?? ""} dari grup ini?`}
          confirmLabel="Hapus"
          onConfirm={handleRemoveMember}
        />
      )}
    </div>
  );
}

// ─── Team Pace Hero ───────────────────────────────────────────────────────────
// Bank Jago vibe: one hero number (team achievement) carried by a progress ring in
// the brand gold, with the rest demoted to quiet supporting stats. The ring IS the
// page's thesis — how close the team is to its collective target.

function TeamPaceHero({
  pct,
  totalSales,
  totalTarget,
  totalConfirmed,
  totalBookings,
  memberCount,
}: {
  pct: number;
  totalSales: number;
  totalTarget: number;
  totalConfirmed: number;
  totalBookings: number;
  memberCount: number;
}) {
  const onTrack = pct >= 80;
  return (
    <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-stretch">
        {/* Ring — the hero. Gold when on track, ink otherwise. */}
        <div className="flex items-center gap-4 p-5 sm:p-6 sm:w-72 sm:shrink-0 sm:border-r border-b sm:border-b-0 border-border bg-gradient-to-br from-secondary/40 to-transparent">
          <PaceRing pct={pct} onTrack={onTrack} />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Pencapaian Tim
            </p>
            <p className="text-sm font-medium text-foreground mt-1 leading-snug">
              {onTrack ? "Tim on track" : pct > 0 ? "Di bawah target" : "Belum ada penjualan"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatRp(totalSales)} dari {formatRp(totalTarget)}
            </p>
          </div>
        </div>

        {/* Supporting stats — quiet, demoted */}
        <div className="grid grid-cols-3 flex-1 divide-x divide-border">
          <PaceStat
            icon={Dollar}
            label="Penjualan"
            value={`Rp ${formatRp(totalSales)}`}
            sub={`target ${formatRp(totalTarget)}`}
          />
          <PaceStat
            icon={CalendarMark}
            label="Confirmed"
            value={`${totalConfirmed}`}
            sub={`dari ${totalBookings} booking`}
          />
          <PaceStat
            icon={UsersGroupRounded}
            label="Anggota"
            value={`${memberCount}`}
            sub="sales aktif"
          />
        </div>
      </div>
    </div>
  );
}

function PaceRing({ pct, onTrack }: { pct: number; onTrack: boolean }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const filled = Math.min(pct, 100) / 100;
  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg viewBox="0 0 72 72" className="h-20 w-20 -rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" strokeWidth="7" className="text-muted/60" stroke="currentColor" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          stroke="currentColor"
          className={cn("transition-all duration-700", onTrack ? "text-[var(--brand-gold)]" : "text-foreground")}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - filled)}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-bold tabular-nums font-heading text-foreground leading-none">
          {pct}%
        </span>
      </div>
    </div>
  );
}

function PaceStat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="p-4 sm:p-5 min-w-0">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0" />
        <p className="text-[10px] font-semibold uppercase tracking-widest truncate">{label}</p>
      </div>
      <p className="text-lg sm:text-xl font-bold font-heading text-foreground leading-tight mt-1.5 truncate">
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p>
    </div>
  );
}
