"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useGroupPerformance } from "@/hooks/use-groups-performance";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
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
  AddCircle,
  PenNewSquare,
  TrashBinTrash,
} from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ChangeLeaderDialog } from "./ChangeLeaderDialog";
import { GroupSalesMasterDetail } from "./GroupSalesMasterDetail";
import { GroupYearSelector } from "@/app/(private)/dashboard/groups/_components/GroupYearSelector";
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

  const { data: performance = initialPerformance } = useGroupPerformance(group.id, initialPerformance);

  // ── Dialog state ─────────────────────────────────────────────────────────────

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [teamName, setTeamName] = useState(group.name);
  const [teamDesc, setTeamDesc] = useState(group.description ?? "");
  const [addOpen, setAddOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [changeLeaderOpen, setChangeLeaderOpen] = useState(false);

  // Year selector — UI state only; TODO: wire to API year param when backend supports it
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  type MemberRow = { profileId: string; name: string; target: number };

  // ── Multi-year target dialog state ───────────────────────────────────────────

  // Dummy per-member annual targets. Key = profileId.
  // TODO: replace with server-fetched data (year-keyed per-member targets) when backend ready.
  const [memberAnnualTargets, setMemberAnnualTargets] = useState<
    Record<string, Array<{ year: number; amount: number }>>
  >({
    // Seeded with different dummy data per member so UI terlihat bervariasi
    __dummy_seed__: [],
  });

  function getMemberTargets(profileId: string): Array<{ year: number; amount: number }> {
    if (memberAnnualTargets[profileId]) return memberAnnualTargets[profileId];
    // Dummy seed: member pertama (rank 1) punya data 2 tahun, sisanya random 1 tahun
    const currentYear = new Date().getFullYear();
    const seed = profileId.charCodeAt(0) % 3;
    if (seed === 0) {
      return [
        { year: currentYear - 1, amount: 1_200_000_000 },
        { year: currentYear, amount: 1_800_000_000 },
      ];
    }
    if (seed === 1) {
      return [{ year: currentYear, amount: 900_000_000 }];
    }
    return [];
  }

  const [editTargetMember, setEditTargetMember] = useState<MemberRow | null>(null);

  // Sub-state inside the multi-year dialog
  // "add" mode: form tambah tahun baru
  // "edit" mode: edit amount existing entry
  const [targetDialogSubMode, setTargetDialogSubMode] = useState<
    | { mode: "list" }
    | { mode: "add"; year: number | null; amount: string }
    | { mode: "edit"; year: number; amount: string }
  >({ mode: "list" });

  const [deleteTargetYear, setDeleteTargetYear] = useState<number | null>(null);

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

  // ── Multi-year target handlers ────────────────────────────────────────────────

  function buildAvailableYears(profileId: string): number[] {
    const currentYear = new Date().getFullYear();
    const targets = getMemberTargets(profileId);
    const usedYears = new Set(targets.map((t) => t.year));
    const opts: number[] = [];
    for (let y = currentYear + 3; y >= 2023; y--) {
      if (!usedYears.has(y)) opts.push(y);
    }
    return opts;
  }

  function openEditTargetDialog(member: SalesListMember) {
    setEditTargetMember({
      profileId: member.profileId,
      name: member.name,
      target: member.target,
    });
    setTargetDialogSubMode({ mode: "list" });
    setDeleteTargetYear(null);
  }

  function handleAddTargetYear() {
    if (!editTargetMember) return;
    if (targetDialogSubMode.mode !== "add") return;
    const { year, amount } = targetDialogSubMode;
    if (!year) return;
    const numAmount = Number(amount) || 0;
    // TODO: wire to backend — call setMemberAnnualTarget(groupId, profileId, year, numAmount) server action
    setMemberAnnualTargets((prev) => {
      const existing = getMemberTargets(editTargetMember.profileId);
      const updated = [...existing.filter((t) => t.year !== year), { year, amount: numAmount }].sort(
        (a, b) => b.year - a.year,
      );
      return { ...prev, [editTargetMember.profileId]: updated };
    });
    toast.success(`Target ${year} berhasil ditambahkan`);
    setTargetDialogSubMode({ mode: "list" });
  }

  function handleEditTargetYear() {
    if (!editTargetMember) return;
    if (targetDialogSubMode.mode !== "edit") return;
    const { year, amount } = targetDialogSubMode;
    const numAmount = Number(amount) || 0;
    // TODO: wire to backend — call setMemberAnnualTarget(groupId, profileId, year, numAmount) server action
    setMemberAnnualTargets((prev) => {
      const existing = getMemberTargets(editTargetMember.profileId);
      const updated = existing.map((t) => (t.year === year ? { ...t, amount: numAmount } : t));
      return { ...prev, [editTargetMember.profileId]: updated };
    });
    toast.success(`Target ${year} berhasil diperbarui`);
    setTargetDialogSubMode({ mode: "list" });
  }

  function handleDeleteTargetYear() {
    if (!editTargetMember || deleteTargetYear === null) return;
    const yearToDelete = deleteTargetYear;
    // TODO: wire to backend — call deleteMemberAnnualTarget(groupId, profileId, year) server action
    setMemberAnnualTargets((prev) => {
      const existing = getMemberTargets(editTargetMember.profileId);
      return {
        ...prev,
        [editTargetMember.profileId]: existing.filter((t) => t.year !== yearToDelete),
      };
    });
    toast.success(`Target ${yearToDelete} dihapus`);
    setDeleteTargetYear(null);
  }

  function closeTargetDialog() {
    setEditTargetMember(null);
    setTargetDialogSubMode({ mode: "list" });
    setDeleteTargetYear(null);
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

        <div className="flex items-center gap-2 shrink-0">
          {/* Year selector — switches performance view year. TODO: pass to API. */}
          <GroupYearSelector value={selectedYear} onChange={setSelectedYear} />

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

      {/* Team Pace — hero: achievement ring (gold) + supporting stats.
          TODO: pass selectedYear to API so performance data reflects chosen year. */}
      <TeamPaceHero
        pct={overallPct}
        totalSales={totalSales}
        totalTarget={totalTarget}
        totalConfirmed={totalConfirmed}
        totalBookings={totalBookings}
        memberCount={memberRows.length}
        year={selectedYear}
      />

      {/* Master-Detail split view */}
      <GroupSalesMasterDetail
        members={salesListMembers}
        canManage={canManage}
        selectedSalesId={selectedSalesId}
        onSelectSales={setSelectedSalesId}
        onAddMember={() => setAddOpen(true)}
        onEditTarget={(member) => openEditTargetDialog(member)}
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

      {/* Edit Target Dialog — multi-year per member */}
      {canManage && editTargetMember && (
        <MemberAnnualTargetDialog
          member={editTargetMember}
          targets={getMemberTargets(editTargetMember.profileId)}
          subMode={targetDialogSubMode}
          availableYears={buildAvailableYears(editTargetMember.profileId)}
          deleteYear={deleteTargetYear}
          onSubModeChange={setTargetDialogSubMode}
          onDeleteYearChange={setDeleteTargetYear}
          onAdd={handleAddTargetYear}
          onEdit={handleEditTargetYear}
          onDelete={handleDeleteTargetYear}
          onClose={closeTargetDialog}
        />
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

// ─── Member Annual Target Dialog ─────────────────────────────────────────────
// Multi-year target per individual member. Opens from "Edit Target" in the kebab menu.
// Three sub-modes inside one Dialog: list → add form / edit form. Delete uses ConfirmDialog.

type SubMode =
  | { mode: "list" }
  | { mode: "add"; year: number | null; amount: string }
  | { mode: "edit"; year: number; amount: string };

interface TargetEntry {
  year: number;
  amount: number;
}

interface MemberAnnualTargetDialogProps {
  member: { profileId: string; name: string; target: number };
  targets: TargetEntry[];
  subMode: SubMode;
  availableYears: number[];
  deleteYear: number | null;
  onSubModeChange: (m: SubMode) => void;
  onDeleteYearChange: (y: number | null) => void;
  onAdd: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function formatRpShort(n: number): string {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(0)}jt`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function formatRpFull(n: number): string {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function MemberAnnualTargetDialog({
  member,
  targets,
  subMode,
  availableYears,
  deleteYear,
  onSubModeChange,
  onDeleteYearChange,
  onAdd,
  onEdit,
  onDelete,
  onClose,
}: MemberAnnualTargetDialogProps): React.JSX.Element {
  const currentYear = new Date().getFullYear();
  const sorted = [...targets].sort((a, b) => b.year - a.year);

  return (
    <>
      <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogTitle>
            Target Tahunan — {member.name}
          </DialogTitle>

          {/* ── LIST view ── */}
          {subMode.mode === "list" && (
            <div className="mt-2 space-y-3">
              {/* Target list */}
              {sorted.length === 0 ? (
                <div className="py-6 flex flex-col items-center gap-2 text-center">
                  <p className="text-sm text-muted-foreground">Belum ada target tahunan</p>
                </div>
              ) : (
                <div className="divide-y divide-border rounded-2xl border border-border overflow-hidden">
                  {sorted.map((t) => {
                    const isThisYear = t.year === currentYear;
                    const isPast = t.year < currentYear;
                    return (
                      <div
                        key={t.year}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 transition-colors",
                          isThisYear && "bg-secondary/30",
                        )}
                      >
                        {/* Year column */}
                        <div className="shrink-0 flex flex-col items-start gap-0.5 w-14">
                          <span
                            className={cn(
                              "text-lg font-bold tabular-nums font-heading leading-none",
                              isThisYear
                                ? "text-[var(--brand-gold)]"
                                : isPast
                                  ? "text-muted-foreground"
                                  : "text-foreground",
                            )}
                          >
                            {t.year}
                          </span>
                          {isThisYear && (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1 py-0 h-3.5 border-[var(--brand-gold)]/50 text-[var(--brand-gold)]"
                            >
                              aktif
                            </Badge>
                          )}
                          {isPast && (
                            <span className="text-[9px] font-medium text-muted-foreground/60">
                              lalu
                            </span>
                          )}
                          {!isThisYear && !isPast && (
                            <span className="text-[9px] font-medium text-muted-foreground/60">
                              akan datang
                            </span>
                          )}
                        </div>

                        {/* Amount column */}
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm font-bold font-heading tabular-nums leading-tight",
                            isPast ? "text-muted-foreground" : "text-foreground",
                          )}>
                            {formatRpShort(t.amount)}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {formatRpFull(t.amount)}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            aria-label={`Edit target ${t.year}`}
                            onClick={() =>
                              onSubModeChange({ mode: "edit", year: t.year, amount: String(t.amount) })
                            }
                            className="flex items-center justify-center h-8 w-8 rounded-xl hover:bg-accent transition-colors"
                          >
                            <PenNewSquare weight="BoldDuotone" className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Hapus target ${t.year}`}
                            onClick={() => onDeleteYearChange(t.year)}
                            className="flex items-center justify-center h-8 w-8 rounded-xl hover:bg-destructive/10 text-destructive transition-colors"
                          >
                            <TrashBinTrash weight="BoldDuotone" className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add button */}
              {availableYears.length > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-9 gap-1.5 text-xs rounded-xl"
                  onClick={() =>
                    onSubModeChange({
                      mode: "add",
                      year: availableYears[0] ?? currentYear + 1,
                      amount: "",
                    })
                  }
                >
                  <AddCircle weight="BoldDuotone" className="h-3.5 w-3.5" />
                  Tambah Target Tahun
                </Button>
              ) : (
                <p className="text-xs text-center text-muted-foreground py-1">
                  Semua tahun sudah memiliki target
                </p>
              )}

              <Button
                variant="ghost"
                className="w-full h-9 text-sm rounded-xl"
                onClick={onClose}
              >
                Tutup
              </Button>
            </div>
          )}

          {/* ── ADD form ── */}
          {subMode.mode === "add" && (
            <div className="mt-2 space-y-4">
              <div>
                <Label htmlFor="add-member-target-year" className="text-sm font-medium">
                  Tahun
                </Label>
                <select
                  id="add-member-target-year"
                  value={subMode.year ?? ""}
                  onChange={(e) =>
                    onSubModeChange({ ...subMode, year: Number(e.target.value) })
                  }
                  className="mt-1 w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      {y === currentYear ? `${y} (tahun ini)` : String(y)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="add-member-target-amount" className="text-sm font-medium">
                  Target Penjualan
                </Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                    Rp
                  </span>
                  <Input
                    id="add-member-target-amount"
                    type="text"
                    className="pl-9 rounded-xl text-base sm:text-sm"
                    value={subMode.amount ? Number(subMode.amount).toLocaleString("id-ID") : ""}
                    onChange={(e) =>
                      onSubModeChange({ ...subMode, amount: e.target.value.replace(/\D/g, "") })
                    }
                    placeholder="0"
                    autoFocus
                  />
                </div>
                {subMode.amount && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatRpFull(Number(subMode.amount))}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => onSubModeChange({ mode: "list" })}
                >
                  Batal
                </Button>
                <Button
                  className="flex-1 rounded-xl"
                  disabled={!subMode.year || !subMode.amount}
                  onClick={onAdd}
                >
                  Simpan
                </Button>
              </div>
            </div>
          )}

          {/* ── EDIT form ── */}
          {subMode.mode === "edit" && (
            <div className="mt-2 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Tahun</span>
                <span
                  className={cn(
                    "text-sm font-bold font-heading tabular-nums",
                    subMode.year === currentYear
                      ? "text-[var(--brand-gold)]"
                      : "text-foreground",
                  )}
                >
                  {subMode.year}
                </span>
                {subMode.year === currentYear && (
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1.5 py-0 h-4 border-[var(--brand-gold)]/50 text-[var(--brand-gold)]"
                  >
                    aktif
                  </Badge>
                )}
              </div>
              <div>
                <Label htmlFor="edit-member-target-amount" className="text-sm font-medium">
                  Target Penjualan
                </Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                    Rp
                  </span>
                  <Input
                    id="edit-member-target-amount"
                    type="text"
                    className="pl-9 rounded-xl text-base sm:text-sm"
                    value={subMode.amount ? Number(subMode.amount).toLocaleString("id-ID") : ""}
                    onChange={(e) =>
                      onSubModeChange({ ...subMode, amount: e.target.value.replace(/\D/g, "") })
                    }
                    placeholder="0"
                    autoFocus
                  />
                </div>
                {subMode.amount && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatRpFull(Number(subMode.amount))}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => onSubModeChange({ mode: "list" })}
                >
                  Batal
                </Button>
                <Button
                  className="flex-1 rounded-xl"
                  disabled={!subMode.amount}
                  onClick={onEdit}
                >
                  Simpan
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete year confirm — rendered outside the main dialog so it stacks on top */}
      <ConfirmDialog
        open={deleteYear !== null}
        onOpenChange={(o) => { if (!o) onDeleteYearChange(null); }}
        title="Hapus Target"
        description={`Yakin ingin menghapus target tahun ${deleteYear ?? ""}?`}
        confirmLabel="Hapus"
        onConfirm={onDelete}
        destructive
      />
    </>
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
  year,
}: {
  pct: number;
  totalSales: number;
  totalTarget: number;
  totalConfirmed: number;
  totalBookings: number;
  memberCount: number;
  year?: number;
}) {
  const currentYear = new Date().getFullYear();
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
              {year && year !== currentYear && (
                <span className="ml-1 font-normal">· {year}</span>
              )}
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
