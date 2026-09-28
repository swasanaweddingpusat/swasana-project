"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AddCircle, Pen, UserRounded, UsersGroupRounded } from "@solar-icons/react";
import { Drawer } from "@/components/shared/drawer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionLabel } from "../../_components/SectionLabel";
import { DrawerFooter } from "../../_components/DrawerFooter";
import { MONTHS } from "../../_components/PeriodSelector";
import { useCreateAwardWinner, useUpdateAwardWinner, useProfilesForAssignment } from "@/hooks/useKpiInsentif";
import { useGroups } from "@/hooks/use-groups";
import type { KpiAwardRow } from "@/lib/queries/kpiInsentif";
import type { KpiAwardWinnerItem } from "@/types/kpiInsentif";

export interface AwardWinnerPrefill {
  profileId: string;
  fullName?: string | null;
  rankValueSnapshot?: number | null;
}

interface AwardWinnerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  award: KpiAwardRow | null;
  month: number;
  year: number;
  editItem?: KpiAwardWinnerItem | null;
  prefill?: AwardWinnerPrefill | null;
}

type WinnerMode = "individual" | "team";

type FormState = {
  mode: WinnerMode;
  profileId: string;
  groupId: string;
  periodMonth: string;
  periodYear: string;
  prizeDescription: string;
  rankValueSnapshot: string;
  notes: string;
};

function buildEmptyForm(month: number, year: number): FormState {
  return {
    mode: "individual",
    profileId: "",
    groupId: "",
    periodMonth: String(month),
    periodYear: String(year),
    prizeDescription: "",
    rankValueSnapshot: "",
    notes: "",
  };
}

export function AwardWinnerDrawer({
  isOpen,
  onClose,
  award,
  month,
  year,
  editItem,
  prefill,
}: AwardWinnerDrawerProps) {
  const isEditMode = editItem != null;
  const [form, setForm] = useState<FormState>(() => buildEmptyForm(month, year));
  const [winnerError, setWinnerError] = useState<string | null>(null);

  const createMutation = useCreateAwardWinner();
  const updateMutation = useUpdateAwardWinner();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Profile picker menyempit sesuai businessRole award (null = semua role,
  // tidak difilter) — lihat catatan di getProfilesForKpiAssignment.
  const { data: profiles = [] } = useProfilesForAssignment(award?.businessRole ?? undefined);
  const { data: groupsResult } = useGroups();
  const groups = groupsResult?.data ?? [];

  const yearOptions = Array.from({ length: 5 }, (_, i) => year - 2 + i);

  // Re-derive form state from props during render (not in an effect) — React's
  // documented pattern for "adjust state when a prop changes" avoids the
  // cascading-render issue of calling setState synchronously inside useEffect.
  const syncKey = isOpen
    ? isEditMode && editItem
      ? `edit:${editItem.id}`
      : prefill
      ? `prefill:${prefill.profileId}`
      : `blank:${month}-${year}`
    : null;
  const [syncedKey, setSyncedKey] = useState<string | null>(null);

  if (isOpen && syncKey !== syncedKey) {
    setSyncedKey(syncKey);
    if (isEditMode && editItem) {
      const d = new Date(editItem.period);
      setForm({
        mode: editItem.groupId ? "team" : "individual",
        profileId: editItem.profileId ?? "",
        groupId: editItem.groupId ?? "",
        periodMonth: String(d.getMonth() + 1),
        periodYear: String(d.getFullYear()),
        prizeDescription: editItem.prizeDescription ?? "",
        rankValueSnapshot: editItem.rankValueSnapshot != null ? String(editItem.rankValueSnapshot) : "",
        notes: editItem.notes ?? "",
      });
    } else if (prefill) {
      setForm({
        ...buildEmptyForm(month, year),
        mode: "individual",
        profileId: prefill.profileId,
        rankValueSnapshot: prefill.rankValueSnapshot != null ? String(prefill.rankValueSnapshot) : "",
      });
    } else {
      setForm(buildEmptyForm(month, year));
    }
  } else if (!isOpen && syncedKey !== null) {
    // Clear the sync marker on close so reopening with the SAME editItem/prefill
    // (same syncKey) re-syncs instead of being skipped as a no-op.
    setSyncedKey(null);
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleClose() {
    setForm(buildEmptyForm(month, year));
    setWinnerError(null);
    onClose();
  }

  async function handleSubmit() {
    if (!award) {
      toast.error("Award tidak ditemukan");
      return;
    }
    if (form.mode === "individual" && !form.profileId) {
      setWinnerError("Pilih pemenang individu terlebih dahulu");
      return;
    }
    if (form.mode === "team" && !form.groupId) {
      setWinnerError("Pilih tim pemenang terlebih dahulu");
      return;
    }
    setWinnerError(null);

    const payload = {
      awardId: award.id,
      period: `${form.periodYear}-${form.periodMonth.padStart(2, "0")}-01`,
      profileId: form.mode === "individual" ? form.profileId : null,
      groupId: form.mode === "team" ? form.groupId : null,
      prizeDescription: form.prizeDescription.trim() || null,
      rankValueSnapshot: form.rankValueSnapshot !== "" ? form.rankValueSnapshot : null,
      notes: form.notes.trim() || null,
    };

    if (isEditMode && editItem) {
      const result = await updateMutation.mutateAsync({ id: editItem.id, data: payload });
      if (result.success) {
        toast.success("Pemenang berhasil diperbarui");
        handleClose();
      } else {
        toast.error(result.error ?? "Gagal memperbarui pemenang");
      }
    } else {
      const result = await createMutation.mutateAsync(payload);
      if (result.success) {
        toast.success("Pemenang berhasil ditetapkan");
        handleClose();
      } else {
        toast.error(result.error ?? "Gagal menetapkan pemenang");
      }
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditMode ? "Edit Pemenang Award" : "Tetapkan Pemenang Award"}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
        className="flex flex-col h-full gap-4"
      >
        <div className="flex-1 overflow-y-auto space-y-4 pb-2">
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <SectionLabel text="Award & Periode" />

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Award</Label>
              <Input
                value={award?.name ?? "-"}
                disabled
                className="rounded-xl bg-muted/40 text-muted-foreground"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Bulan <span className="text-destructive">*</span>
                </Label>
                <Select value={form.periodMonth} onValueChange={(v) => setField("periodMonth", v)}>
                  <SelectTrigger className="rounded-xl w-full">
                    <SelectValue placeholder="Bulan" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Tahun <span className="text-destructive">*</span>
                </Label>
                <Select value={form.periodYear} onValueChange={(v) => setField("periodYear", v)}>
                  <SelectTrigger className="rounded-xl w-full">
                    <SelectValue placeholder="Tahun" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <SectionLabel text="Pemenang" />

            <div className="grid grid-cols-2 gap-1.5">
              {(["individual", "team"] as const).map((opt) => {
                const active = form.mode === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => { setField("mode", opt); setWinnerError(null); }}
                    className={[
                      "flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-full transition-colors",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-accent",
                    ].join(" ")}
                  >
                    {opt === "individual" ? (
                      <UserRounded weight="BoldDuotone" className="h-4 w-4" />
                    ) : (
                      <UsersGroupRounded weight="BoldDuotone" className="h-4 w-4" />
                    )}
                    {opt === "individual" ? "Individu" : "Tim"}
                  </button>
                );
              })}
            </div>

            {form.mode === "individual" ? (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Karyawan <span className="text-destructive">*</span>
                </Label>
                <Select value={form.profileId} onValueChange={(v) => { setField("profileId", v); setWinnerError(null); }}>
                  <SelectTrigger className="rounded-xl w-full" aria-invalid={!!winnerError}>
                    <SelectValue placeholder="Pilih karyawan" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.fullName ?? p.id}
                        {p.roleName ? ` — ${p.roleName}` : ""}
                      </SelectItem>
                    ))}
                    {profiles.length === 0 && (
                      <SelectItem value="__empty__" disabled>
                        Tidak ada karyawan yang cocok
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {winnerError && <p className="text-xs text-destructive">{winnerError}</p>}
                {!winnerError && award?.businessRole && (
                  <p className="text-xs text-muted-foreground">
                    Menampilkan karyawan dengan role &ldquo;{award.businessRole}&rdquo;
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Tim / Grup <span className="text-destructive">*</span>
                </Label>
                <Select value={form.groupId} onValueChange={(v) => { setField("groupId", v); setWinnerError(null); }}>
                  <SelectTrigger className="rounded-xl w-full" aria-invalid={!!winnerError}>
                    <SelectValue placeholder="Pilih tim" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                    {groups.length === 0 && (
                      <SelectItem value="__empty__" disabled>
                        Belum ada tim
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {winnerError && <p className="text-xs text-destructive">{winnerError}</p>}
              </div>
            )}
          </div>

          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <SectionLabel text="Hadiah & Catatan" />

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Deskripsi Hadiah (opsional)</Label>
              <Input
                placeholder="Kosongkan untuk pakai hadiah default award"
                value={form.prizeDescription}
                onChange={(e) => setField("prizeDescription", e.target.value)}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Nilai Ranking (opsional)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Nilai metrik saat ditetapkan sebagai pemenang"
                value={form.rankValueSnapshot}
                onChange={(e) => setField("rankValueSnapshot", e.target.value)}
                className="rounded-xl"
              />
              <p className="text-xs text-muted-foreground">
                Terisi otomatis saat konfirmasi dari daftar kandidat ranking
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Catatan (opsional)</Label>
              <Textarea
                placeholder="Catatan tambahan..."
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                className="rounded-xl min-h-20 resize-y"
              />
            </div>
          </div>
        </div>

        <DrawerFooter
          onCancel={handleClose}
          isSaving={isSaving}
          submitLabel={isEditMode ? "Simpan Perubahan" : "Tetapkan Pemenang"}
          submitIcon={
            isEditMode ? (
              <Pen weight="BoldDuotone" className="h-4 w-4" />
            ) : (
              <AddCircle weight="BoldDuotone" className="h-4 w-4" />
            )
          }
        />
      </form>
    </Drawer>
  );
}
