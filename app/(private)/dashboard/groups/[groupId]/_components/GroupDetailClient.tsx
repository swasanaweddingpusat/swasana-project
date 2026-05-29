"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Drawer } from "@/components/shared/drawer";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Target,
  Users,
  DollarSign,
  CalendarCheck,
  Settings,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SalesDetailModal } from "./SalesDetailModal";
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
  const [targetFrom, setTargetFrom] = useState("");
  const [targetTo, setTargetTo] = useState("");

  const [deleteMember, setDeleteMember] = useState<MemberRow | null>(null);

  // SalesDetailModal state
  const [detailMemberId, setDetailMemberId] = useState<string | null>(null);

  // ── Derived data ─────────────────────────────────────────────────────────────

  const leaderMember = group.members.find((m) => m.userId === group.leaderId);

  const memberRows = group.members.map((m) => {
    const perf = performance.find((p) => p.profileId === m.userId);
    return {
      profileId: m.userId,
      name: m.profile.fullName ?? m.userId,
      avatarUrl: m.profile.avatarUrl ?? undefined,
      target: perf?.target ?? 0,
      targetStartDate: perf?.targetStartDate ?? null,
      targetEndDate: perf?.targetEndDate ?? null,
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
    addMemberMutation.mutate(
      { groupId: group.id, userId: profileId },
      {
        onSuccess: (res) => {
          if (res.success) {
            toast.success("Anggota berhasil ditambahkan");
            setAddOpen(false);
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
            setDeleteMember(null);
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
        startDate: targetFrom,
        endDate: targetTo,
      },
      {
        onSuccess: (res) => {
          if (res.success) {
            toast.success("Target berhasil disimpan");
            setEditTargetMember(null);
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
      {/* Group Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {leaderMember && (
            <ProfileAvatar
              name={leaderMember.profile.fullName ?? leaderMember.userId}
              src={leaderMember.profile.avatarUrl ?? undefined}
              size="md"
            />
          )}
          <div>
            <h1 className="text-base font-bold text-foreground">{teamName}</h1>
            {leaderMember && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Leader: {leaderMember.profile.fullName ?? leaderMember.userId}
              </p>
            )}
            {teamDesc && (
              <p className="text-sm text-muted-foreground mt-0.5">{teamDesc}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isSuperAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => setChangeLeaderOpen(true)}
            >
              <UserCog className="h-3.5 w-3.5" /> Ganti Leader
            </Button>
          )}
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="h-3.5 w-3.5" /> Pengaturan
            </Button>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <OverviewCard
          icon={DollarSign}
          label="Total Penjualan"
          value={formatRp(totalSales)}
          sub={`dari target ${formatRp(totalTarget)}`}
        />
        <OverviewCard
          icon={Target}
          label="Achievement"
          value={`${overallPct}%`}
          sub={overallPct >= 80 ? "On track" : "Below target"}
          accent={overallPct >= 80}
        />
        <OverviewCard
          icon={CalendarCheck}
          label="Booking Confirmed"
          value={`${totalConfirmed}`}
          sub={`dari ${totalBookings} total booking`}
        />
        <OverviewCard
          icon={Users}
          label="Anggota Grup"
          value={`${memberRows.length}`}
          sub="Sales aktif"
        />
      </div>

      {/* Master-Detail split view */}
      <GroupSalesMasterDetail
        members={salesListMembers}
        canManage={canManage}
        onAddMember={() => setAddOpen(true)}
        onEditTarget={(member) => {
          setEditTargetMember({
            profileId: member.profileId,
            name: member.name,
            target: member.target,
          });
          setTargetInput(member.target.toString());
          setTargetFrom(member.targetStartDate?.slice(0, 10) ?? "");
          setTargetTo(member.targetEndDate?.slice(0, 10) ?? "");
        }}
        onRemoveMember={(member) =>
          setDeleteMember({
            profileId: member.profileId,
            name: member.name,
            target: member.target,
          })
        }
        onViewAllBookings={(member) => setDetailMemberId(member.profileId)}
      />

      {/* Sales Detail Modal (full history) */}
      <SalesDetailModal
        memberId={detailMemberId}
        memberName={sorted.find((m) => m.profileId === detailMemberId)?.name ?? ""}
        memberAvatarUrl={
          sorted.find((m) => m.profileId === detailMemberId)?.avatarUrl ?? null
        }
        memberTarget={sorted.find((m) => m.profileId === detailMemberId)?.target ?? 0}
        memberActual={sorted.find((m) => m.profileId === detailMemberId)?.actual ?? 0}
        onClose={() => setDetailMemberId(null)}
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
                        <span>{p.fullName ?? p.id}</span>
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
                <Label htmlFor="target-from" className="text-sm">Periode</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    id="target-from"
                    type="date"
                    className="flex-1 text-base sm:text-sm"
                    value={targetFrom}
                    onChange={(e) => setTargetFrom(e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground shrink-0">s/d</span>
                  <Input
                    id="target-to"
                    type="date"
                    className="flex-1 text-base sm:text-sm"
                    value={targetTo}
                    onChange={(e) => setTargetTo(e.target.value)}
                  />
                </div>
              </div>
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
                disabled={isPending || !targetFrom || !targetTo}
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

// ─── Overview Card ────────────────────────────────────────────────────────────

function OverviewCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
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
          <div
            className={cn(
              "flex items-center justify-center h-9 w-9 rounded-lg shrink-0",
              accent ? "bg-primary text-primary-foreground" : "bg-secondary",
            )}
          >
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
