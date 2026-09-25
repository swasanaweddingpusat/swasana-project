"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AddCircle,
  Pen,
  TrashBinTrash,
  MedalRibbonStar,
  CheckCircle,
  UserRounded,
  UsersGroupRounded,
} from "@solar-icons/react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { usePermissions } from "@/hooks/use-permissions";
import {
  useAwards,
  useDeleteAward,
  useAwardWinners,
  useAwardCandidates,
  useDeleteAwardWinner,
} from "@/hooks/useKpiInsentif";
import { formatRupiah, formatPct } from "@/lib/utils/kpiFormatters";
import type { KpiAwardRow } from "@/lib/queries/kpiInsentif";
import type { KpiAwardRankingMetric, KpiAwardCandidateItem, KpiAwardWinnerItem } from "@/types/kpiInsentif";
import { SummaryCard, SummaryCardSkeleton } from "@/components/shared/SummaryCard";
import { SectionLabel } from "../../_components/SectionLabel";
import { EmptyState } from "../../_components/EmptyState";
import { PeriodSelector, MONTHS, buildPeriodKey } from "../../_components/PeriodSelector";
import { AwardDrawer } from "./AwardDrawer";
import { AwardWinnerDrawer, type AwardWinnerPrefill } from "./AwardWinnerDrawer";

interface AwardsClientProps {
  initialAwards: KpiAwardRow[];
}

const RANKING_METRIC_LABELS: Record<Exclude<KpiAwardRankingMetric, "manual">, string> = {
  totalBonus: "Total Bonus",
  netAmount: "Net Amount",
  dealingAchievementPct: "% Capaian Dealing",
  omsetAchievementPct: "% Capaian Omset",
};

function formatCandidateValue(metric: KpiAwardRankingMetric | null, candidate: KpiAwardCandidateItem): string {
  if (metric === "totalBonus") return formatRupiah(candidate.totalBonus);
  if (metric === "netAmount") return formatRupiah(candidate.netAmount);
  if (metric === "dealingAchievementPct") return formatPct(candidate.dealingAchievementPct);
  if (metric === "omsetAchievementPct") return formatPct(candidate.omsetAchievementPct);
  return "—";
}

export function AwardsClient({ initialAwards }: AwardsClientProps) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const period = buildPeriodKey(month, year);
  const periodLabel = `${MONTHS[month - 1]} ${year}`;

  const [selectedAwardId, setSelectedAwardId] = useState<string | null>(null);

  const [awardDrawerOpen, setAwardDrawerOpen] = useState(false);
  const [editAward, setEditAward] = useState<KpiAwardRow | null>(null);
  const [deleteAwardId, setDeleteAwardId] = useState<string | null>(null);
  const [deleteAwardName, setDeleteAwardName] = useState<string>("");

  const [winnerDrawerOpen, setWinnerDrawerOpen] = useState(false);
  const [editWinner, setEditWinner] = useState<KpiAwardWinnerItem | null>(null);
  const [winnerPrefill, setWinnerPrefill] = useState<AwardWinnerPrefill | null>(null);
  const [deleteWinnerId, setDeleteWinnerId] = useState<string | null>(null);

  const { data: awards = initialAwards, isLoading } = useAwards();
  const deleteAwardMutation = useDeleteAward();
  const deleteWinnerMutation = useDeleteAwardWinner();
  const { can, isAdmin } = usePermissions();

  const canCreateAward = isAdmin || can("kpi-master", "create");
  const canEditAward = isAdmin || can("kpi-master", "edit");
  const canDeleteAward = isAdmin || can("kpi-master", "delete");
  const canManageWinner = isAdmin || can("kpi-award", "create") || can("kpi-award", "edit");
  const canDeleteWinner = isAdmin || can("kpi-award", "delete");

  const selectedAward = awards.find((a) => a.id === selectedAwardId) ?? null;

  const { data: winnersThisMonth = [] } = useAwardWinners({ period });

  const { data: selectedAwardWinners = [], isLoading: isLoadingWinners } = useAwardWinners({
    awardId: selectedAwardId ?? undefined,
    period,
  });

  const { data: candidates = [], isLoading: isLoadingCandidates } = useAwardCandidates(
    selectedAward?.isRanked ? selectedAward.id : undefined,
    selectedAward?.isRanked ? period : undefined
  );

  function handleAddAward() {
    setEditAward(null);
    setAwardDrawerOpen(true);
  }

  function handleEditAward(award: KpiAwardRow) {
    setEditAward(award);
    setAwardDrawerOpen(true);
  }

  function handleCloseAwardDrawer() {
    setAwardDrawerOpen(false);
    setEditAward(null);
  }

  function confirmDeleteAward(award: KpiAwardRow) {
    setDeleteAwardId(award.id);
    setDeleteAwardName(award.name);
  }

  async function handleDeleteAward() {
    if (!deleteAwardId) return;
    const result = await deleteAwardMutation.mutateAsync(deleteAwardId);
    if (result.success) {
      toast.success("Award berhasil dihapus");
      if (selectedAwardId === deleteAwardId) setSelectedAwardId(null);
    } else {
      toast.error(result.error ?? "Gagal menghapus award");
    }
    setDeleteAwardId(null);
    setDeleteAwardName("");
  }

  function handleAddWinnerManual() {
    setEditWinner(null);
    setWinnerPrefill(null);
    setWinnerDrawerOpen(true);
  }

  function handleConfirmCandidate(candidate: KpiAwardCandidateItem) {
    setEditWinner(null);
    setWinnerPrefill({
      profileId: candidate.profileId,
      fullName: candidate.fullName,
      rankValueSnapshot: candidate.rankValue,
    });
    setWinnerDrawerOpen(true);
  }

  function handleEditWinner(winner: KpiAwardWinnerItem) {
    setEditWinner(winner);
    setWinnerPrefill(null);
    setWinnerDrawerOpen(true);
  }

  function handleCloseWinnerDrawer() {
    setWinnerDrawerOpen(false);
    setEditWinner(null);
    setWinnerPrefill(null);
  }

  async function handleDeleteWinner() {
    if (!deleteWinnerId) return;
    const result = await deleteWinnerMutation.mutateAsync(deleteWinnerId);
    if (result.success) {
      toast.success("Pemenang berhasil dihapus");
    } else {
      toast.error(result.error ?? "Gagal menghapus pemenang");
    }
    setDeleteWinnerId(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Awards & Best Performer"
        description="Kelola award dan tetapkan pemenang Sales/Manager terbaik"
        action={
          canCreateAward ? (
            <Button onClick={handleAddAward} className="rounded-full gap-2">
              <AddCircle weight="BoldDuotone" className="h-4 w-4" />
              Tambah Award
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="grid grid-cols-2 gap-4 flex-1">
          {isLoading ? (
            <>
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
            </>
          ) : (
            <>
              <SummaryCard
                label="Total Award Aktif"
                value={awards.filter((a) => a.isActive).length}
                sub={`dari ${awards.length} award terdaftar`}
                icon={<MedalRibbonStar weight="BoldDuotone" className="h-3.5 w-3.5" />}
              />
              <SummaryCard
                label="Pemenang Bulan Ini"
                value={winnersThisMonth.length}
                sub={`periode ${periodLabel}`}
                icon={<CheckCircle weight="BoldDuotone" className="h-3.5 w-3.5" />}
              />
            </>
          )}
        </div>
        <PeriodSelector month={month} year={year} onMonthChange={setMonth} onYearChange={setYear} />
      </div>

      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        ) : awards.length === 0 ? (
          <EmptyState
            icon={<MedalRibbonStar weight="BoldDuotone" className="h-8 w-8 text-muted-foreground" />}
            title="Belum ada award"
            description="Tambahkan award untuk mulai menetapkan Best Performer"
            action={
              canCreateAward ? (
                <Button onClick={handleAddAward} className="rounded-full gap-2" size="sm">
                  <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                  Tambah Award
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Nama Award</TableHead>
                  <TableHead>Role Scope</TableHead>
                  <TableHead>Mekanisme</TableHead>
                  <TableHead>Metrik Ranking</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-5 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {awards.map((award) => {
                  const isSelected = award.id === selectedAwardId;
                  return (
                    <TableRow
                      key={award.id}
                      className={isSelected ? "bg-accent cursor-pointer" : "cursor-pointer"}
                      onClick={() => setSelectedAwardId(isSelected ? null : award.id)}
                    >
                      <TableCell className="pl-5 font-medium">{award.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full text-xs capitalize">
                          {award.businessRole ?? "Semua Role"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={award.isRanked ? "default" : "secondary"}
                          className="rounded-full text-xs"
                        >
                          {award.isRanked ? "Otomatis" : "Manual"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {award.isRanked && award.rankingMetric && award.rankingMetric !== "manual"
                          ? RANKING_METRIC_LABELS[award.rankingMetric]
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={award.isActive ? "default" : "outline"}
                          className="rounded-full text-xs"
                        >
                          {award.isActive ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-5">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          {canEditAward && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-xl"
                              onClick={() => handleEditAward(award)}
                            >
                              <Pen weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          )}
                          {canDeleteAward && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-xl text-destructive hover:text-destructive"
                              onClick={() => confirmDeleteAward(award)}
                            >
                              <TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {selectedAward && (
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <SectionLabel text={`Pemenang — ${selectedAward.name}`} />
              <p className="text-xs text-muted-foreground mt-1">
                Periode {periodLabel}
                {selectedAward.isRanked ? " · diurutkan otomatis berdasarkan metrik" : " · pemilihan manual"}
              </p>
            </div>
            {!selectedAward.isRanked && canManageWinner && (
              <Button onClick={handleAddWinnerManual} size="sm" className="rounded-full gap-1.5 shrink-0">
                <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                Tambah Pemenang Manual
              </Button>
            )}
          </div>

          {selectedAward.isRanked ? (
            isLoadingCandidates ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-xl" />
                ))}
              </div>
            ) : candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Belum ada kandidat untuk periode ini
              </p>
            ) : (
              <div className="space-y-2">
                {candidates.map((candidate, idx) => (
                  <div
                    key={candidate.resultId}
                    className="flex items-center justify-between gap-3 rounded-xl border p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{candidate.fullName ?? "-"}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCandidateValue(selectedAward.rankingMetric, candidate)}
                        </p>
                      </div>
                    </div>
                    {canManageWinner && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full gap-1.5 shrink-0"
                        onClick={() => handleConfirmCandidate(candidate)}
                      >
                        <CheckCircle weight="BoldDuotone" className="h-3.5 w-3.5" />
                        Konfirmasi
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : isLoadingWinners ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : selectedAwardWinners.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Belum ada pemenang ditetapkan untuk periode ini
            </p>
          ) : (
            <div className="space-y-2">
              {selectedAwardWinners.map((winner) => (
                <div
                  key={winner.id}
                  className="flex items-center justify-between gap-3 rounded-xl border p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      {winner.groupId ? (
                        <UsersGroupRounded weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <UserRounded weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {winner.profile?.fullName ?? winner.group?.name ?? "-"}
                      </p>
                      {winner.prizeDescription && (
                        <p className="text-xs text-muted-foreground truncate">{winner.prizeDescription}</p>
                      )}
                    </div>
                  </div>
                  {canManageWinner && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-xl"
                        onClick={() => handleEditWinner(winner)}
                      >
                        <Pen weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      {canDeleteWinner && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-xl text-destructive hover:text-destructive"
                          onClick={() => setDeleteWinnerId(winner.id)}
                        >
                          <TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <AwardDrawer isOpen={awardDrawerOpen} onClose={handleCloseAwardDrawer} editItem={editAward} />

      <AwardWinnerDrawer
        isOpen={winnerDrawerOpen}
        onClose={handleCloseWinnerDrawer}
        award={selectedAward}
        month={month}
        year={year}
        editItem={editWinner}
        prefill={winnerPrefill}
      />

      <AlertDialog open={!!deleteAwardId} onOpenChange={(open: boolean) => { if (!open) setDeleteAwardId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Award</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus award{" "}
              <span className="font-semibold">&ldquo;{deleteAwardName}&rdquo;</span>?
              Award yang sudah punya pemenang tidak dapat dihapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full" disabled={deleteAwardMutation.isPending}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteAward}
              disabled={deleteAwardMutation.isPending}
            >
              {deleteAwardMutation.isPending ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteWinnerId} onOpenChange={(open: boolean) => { if (!open) setDeleteWinnerId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pemenang</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus pemenang ini dari daftar award?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full" disabled={deleteWinnerMutation.isPending}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteWinner}
              disabled={deleteWinnerMutation.isPending}
            >
              {deleteWinnerMutation.isPending ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
