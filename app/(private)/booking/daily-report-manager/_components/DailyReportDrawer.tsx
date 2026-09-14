"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle,
  CloseCircle,
  UsersGroupRounded,
  GraphUp,
  Notes,
} from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Drawer } from "@/components/shared/drawer";
import { cn } from "@/lib/utils";
import {
  useDailyReportMetrics,
  useMemberCompletion,
  useCreateDailyReport,
  useUpdateDailyReport,
} from "@/hooks/use-daily-report-manager";
import type {
  DailyReportListItem,
  DailyReportStatus,
  DailyReportMetrics,
  MemberCompletionItem,
} from "@/hooks/use-daily-report-manager";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface DailyReportDrawerProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  editReport?: DailyReportListItem;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().split("T")[0]!;
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ─────────────────────────────────────────────────────────────────────────────
// Status pill selector
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: DailyReportStatus; label: string }[] = [
  { value: "ON_TRACK", label: "On Track" },
  { value: "AT_RISK", label: "At Risk" },
  { value: "OFF_TRACK", label: "Off Track" },
];

function statusPillClass(
  value: DailyReportStatus,
  selected: boolean,
): string {
  if (!selected) return "border border-border bg-transparent text-muted-foreground hover:bg-accent/50";
  if (value === "ON_TRACK") return "bg-primary/10 text-primary border border-primary/30";
  if (value === "AT_RISK") return "bg-accent text-accent-foreground border border-accent";
  return "bg-destructive/10 text-destructive border border-destructive/30";
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-metrics section
// ─────────────────────────────────────────────────────────────────────────────

interface MetricsRowProps {
  label: string;
  value: number | undefined;
  loading: boolean;
}

function MetricsRow({ label, value, loading }: MetricsRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      {loading ? (
        <Skeleton className="h-5 w-12 rounded-lg" />
      ) : (
        <span className="text-sm font-semibold text-foreground">{value ?? 0}</span>
      )}
    </div>
  );
}

interface AutoMetricsSectionProps {
  groupId: string;
  date: string;
  metricsOverride?: DailyReportMetrics;
}

function AutoMetricsSection({
  groupId,
  date,
  metricsOverride,
}: AutoMetricsSectionProps) {
  const { data, isLoading } = useDailyReportMetrics(
    metricsOverride ? undefined : groupId,
    metricsOverride ? undefined : date,
  );

  const metrics = metricsOverride ?? data;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-2">
      <div className="flex items-center gap-2 mb-1">
        <GraphUp weight="BoldDuotone" className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Hasil Hari Ini</span>
        <span className="text-xs text-muted-foreground ml-auto">
          (dihitung otomatis)
        </span>
      </div>
      <div className="divide-y divide-border">
        <MetricsRow
          label="Client Dihubungi"
          value={metrics?.totalClientDihubungi}
          loading={isLoading && !metricsOverride}
        />
        <MetricsRow
          label="Hot Prospect"
          value={metrics?.totalHotProspect}
          loading={isLoading && !metricsOverride}
        />
        <MetricsRow
          label="Leads Baru"
          value={metrics?.totalLeadsBaru}
          loading={isLoading && !metricsOverride}
        />
        <MetricsRow
          label="Follow Up"
          value={metrics?.totalFollowUp}
          loading={isLoading && !metricsOverride}
        />
        <MetricsRow
          label="Potensi Closing"
          value={metrics?.totalPotensiClosing}
          loading={isLoading && !metricsOverride}
        />
        <MetricsRow
          label="Closing Hari Ini"
          value={metrics?.closingHariIni}
          loading={isLoading && !metricsOverride}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Member completion section
// ─────────────────────────────────────────────────────────────────────────────

interface MemberCompletionSectionProps {
  groupId: string;
  date: string;
  completionOverride?: MemberCompletionItem[];
}

function MemberCompletionSection({
  groupId,
  date,
  completionOverride,
}: MemberCompletionSectionProps) {
  const { data, isLoading } = useMemberCompletion(
    completionOverride ? undefined : groupId,
    completionOverride ? undefined : date,
  );

  const members = completionOverride ?? data ?? [];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <UsersGroupRounded weight="BoldDuotone" className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Anggota Tim</span>
      </div>
      {isLoading && !completionOverride ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 flex-1 rounded-lg" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
          ))}
        </div>
      ) : members.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Tidak ada anggota dalam grup ini.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {members.map((member) => (
            <div
              key={member.profileId}
              className="flex items-center gap-3 py-1"
            >
              {/* Avatar initial */}
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-primary">
                  {getInitials(member.fullName)}
                </span>
              </div>
              <span className="flex-1 text-sm text-foreground">
                {member.fullName ?? "—"}
              </span>
              {member.hasLoggedActivity ? (
                <CheckCircle
                  weight="BoldDuotone"
                  className="h-4 w-4 text-primary shrink-0"
                />
              ) : (
                <CloseCircle
                  weight="BoldDuotone"
                  className="h-4 w-4 text-destructive shrink-0"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Form field wrapper
// ─────────────────────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main drawer
// ─────────────────────────────────────────────────────────────────────────────

export function DailyReportDrawer({
  open,
  onClose,
  groupId,
  groupName,
  editReport,
}: DailyReportDrawerProps) {
  const isEdit = !!editReport;
  const today = todayIso();

  const [status, setStatus] = useState<DailyReportStatus>(editReport?.status ?? "ON_TRACK");
  const [actionBesok, setActionBesok] = useState(editReport?.actionBesok ?? "");
  const [commitVisit, setCommitVisit] = useState(editReport?.commitVisit ?? "");
  const [actualVisit, setActualVisit] = useState(editReport?.actualVisit ?? "");
  const [reason, setReason] = useState(editReport?.reason ?? "");
  const [kendala, setKendala] = useState(editReport?.kendala ?? "");

  const reportDate = editReport?.reportDate ?? today;

  // Metrics and members are auto-loaded for the relevant date / group.
  // For edit mode we show existing stored metrics as read-only.
  const editMetricsOverride: DailyReportMetrics | undefined = editReport
    ? {
        totalClientDihubungi: editReport.totalClientDihubungi,
        totalHotProspect: editReport.totalHotProspect,
        totalLeadsBaru: editReport.totalLeadsBaru,
        totalFollowUp: editReport.totalFollowUp,
        totalPotensiClosing: editReport.totalPotensiClosing,
        closingHariIni: editReport.closingHariIni,
      }
    : undefined;

  const createMutation = useCreateDailyReport();
  const updateMutation = useUpdateDailyReport();

  const isPending = createMutation.isPending || updateMutation.isPending;

  // We also need live metrics for creating (to submit them)
  const { data: liveMetrics } = useDailyReportMetrics(
    !isEdit ? groupId : undefined,
    !isEdit ? today : undefined,
  );
  const { data: liveMembers } = useMemberCompletion(
    !isEdit ? groupId : undefined,
    !isEdit ? today : undefined,
  );

  function handleSubmit() {
    const payload = {
      groupId,
      reportDate,
      status,
      actionBesok: actionBesok.trim() || undefined,
      commitVisit: commitVisit.trim() || undefined,
      actualVisit: actualVisit.trim() || undefined,
      reason: reason.trim() || undefined,
      kendala: kendala.trim() || undefined,
      // Auto-calculated metrics — fall back to 0 if not yet loaded
      totalClientDihubungi:
        editMetricsOverride?.totalClientDihubungi ??
        liveMetrics?.totalClientDihubungi ??
        0,
      totalHotProspect:
        editMetricsOverride?.totalHotProspect ??
        liveMetrics?.totalHotProspect ??
        0,
      totalLeadsBaru:
        editMetricsOverride?.totalLeadsBaru ?? liveMetrics?.totalLeadsBaru ?? 0,
      totalFollowUp:
        editMetricsOverride?.totalFollowUp ?? liveMetrics?.totalFollowUp ?? 0,
      totalPotensiClosing:
        editMetricsOverride?.totalPotensiClosing ??
        liveMetrics?.totalPotensiClosing ??
        0,
      closingHariIni:
        editMetricsOverride?.closingHariIni ?? liveMetrics?.closingHariIni ?? 0,
      membersCompleted:
        editReport?.membersCompleted ??
        liveMembers
          ?.filter((m) => m.hasLoggedActivity)
          .map((m) => m.profileId) ??
        [],
      membersTotal:
        editReport?.membersTotal ?? liveMembers?.length ?? 0,
    };

    if (isEdit) {
      updateMutation.mutate(
        { id: editReport.id, data: payload },
        {
          onSuccess: (res) => {
            if (res.success) {
              toast.success("Laporan berhasil diperbarui");
              onClose();
            } else {
              toast.error(
                "error" in res
                  ? (res.error ?? "Terjadi kesalahan")
                  : "Terjadi kesalahan",
              );
            }
          },
          onError: () => toast.error("Terjadi kesalahan"),
        },
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: (res) => {
          if (res.success) {
            toast.success("Laporan berhasil dibuat");
            onClose();
          } else {
            toast.error(
              "error" in res
                ? (res.error ?? "Terjadi kesalahan")
                : "Terjadi kesalahan",
            );
          }
        },
        onError: () => toast.error("Terjadi kesalahan"),
      });
    }
  }

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title={isEdit ? "Edit Laporan Harian" : "Buat Laporan Harian"}
      maxWidth="sm:max-w-lg"
      childrenClassName="pb-6"
    >
      <div className="flex flex-col gap-5">
        {/* Subtitle */}
        <div className="flex items-center gap-2">
          <Notes weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Grup: <span className="font-medium text-foreground">{groupName}</span>
          </span>
        </div>

        {/* Date display */}
        <Field label="Tanggal Laporan">
          <Input
            type="date"
            value={reportDate}
            readOnly
            disabled
            className="rounded-xl bg-muted cursor-not-allowed"
          />
        </Field>

        {/* Auto-metrics */}
        <AutoMetricsSection
          groupId={groupId}
          date={reportDate}
          metricsOverride={editMetricsOverride}
        />

        {/* Member completion */}
        <MemberCompletionSection
          groupId={groupId}
          date={reportDate}
          completionOverride={
            editReport
              ? editReport.membersCompleted.map((profileId) => ({
                  profileId,
                  fullName: null,
                  avatarUrl: null,
                  hasLoggedActivity: true,
                }))
              : undefined
          }
        />

        {/* Manual fields */}
        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-1">
            <Notes weight="BoldDuotone" className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              Laporan Manual
            </span>
          </div>

          <Field label="Action Besok">
            <Textarea
              placeholder="Rencana aksi untuk besok..."
              className="rounded-xl resize-none"
              rows={3}
              value={actionBesok}
              onChange={(e) => setActionBesok(e.target.value)}
            />
          </Field>

          <Field label="Commit Visit">
            <Input
              placeholder="Target kunjungan..."
              className="rounded-xl"
              value={commitVisit}
              onChange={(e) => setCommitVisit(e.target.value)}
            />
          </Field>

          <Field label="Actual Visit">
            <Input
              placeholder="Realisasi kunjungan..."
              className="rounded-xl"
              value={actualVisit}
              onChange={(e) => setActualVisit(e.target.value)}
            />
          </Field>

          <Field label="Reason">
            <Input
              placeholder="Alasan deviasi..."
              className="rounded-xl"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>

          <Field label="Kendala">
            <Textarea
              placeholder="Kendala yang dihadapi..."
              className="rounded-xl resize-none"
              rows={3}
              value={kendala}
              onChange={(e) => setKendala(e.target.value)}
            />
          </Field>
        </div>

        {/* Status selector */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Status</span>
          <div className="flex items-center gap-2 flex-wrap">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatus(opt.value)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer",
                  statusPillClass(opt.value, status === opt.value),
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Footer buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            variant="outline"
            className="rounded-full"
            onClick={onClose}
            disabled={isPending}
          >
            Batal
          </Button>
          <Button
            className="rounded-full"
            onClick={handleSubmit}
            disabled={isPending}
          >
            {isPending
              ? isEdit
                ? "Menyimpan..."
                : "Membuat..."
              : isEdit
                ? "Simpan Perubahan"
                : "Buat Laporan"}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
