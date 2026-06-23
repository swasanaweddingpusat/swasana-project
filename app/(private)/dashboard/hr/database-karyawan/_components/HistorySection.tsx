"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PermissionGate } from "@/components/shared/permission-gate";
import {
  useEmploymentHistory,
  useAddEmploymentHistory,
} from "@/hooks/use-employees";
import {
  AddCircle,
  ClipboardList,
  ArrowRight,
} from "@solar-icons/react";
import type { EmploymentHistoryItem } from "@/lib/queries/employees";

// ─── Constants ───────────────────────────────────────────────────────────────

const CHANGE_TYPE_OPTIONS = [
  { value: "promotion", label: "Promosi" },
  { value: "transfer", label: "Transfer" },
  { value: "demotion", label: "Demosi" },
  { value: "status_change", label: "Perubahan Status" },
  { value: "contract_renewal", label: "Perpanjangan Kontrak" },
  { value: "salary_change", label: "Perubahan Gaji" },
  { value: "join", label: "Bergabung" },
  { value: "resign", label: "Resign" },
  { value: "other", label: "Lainnya" },
];

const CHANGE_TYPE_LABELS: Record<string, string> = {};
for (const opt of CHANGE_TYPE_OPTIONS) {
  CHANGE_TYPE_LABELS[opt.value] = opt.label;
}

const CHANGE_TYPE_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  promotion: "default",
  transfer: "secondary",
  demotion: "destructive",
  status_change: "secondary",
  contract_renewal: "default",
  salary_change: "secondary",
  join: "default",
  resign: "destructive",
  other: "secondary",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(date: string | Date | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface HistorySectionProps {
  employeeId: string;
}

interface AddHistoryForm {
  changeType: string;
  description: string;
  oldValue: string;
  newValue: string;
  effectiveDate: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function HistorySection({ employeeId }: HistorySectionProps) {
  const { data: history, isLoading } = useEmploymentHistory(employeeId);
  const addMutation = useAddEmploymentHistory();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<AddHistoryForm>({
    changeType: "",
    description: "",
    oldValue: "",
    newValue: "",
    effectiveDate: "",
  });

  const resetForm = useCallback(() => {
    setForm({
      changeType: "",
      description: "",
      oldValue: "",
      newValue: "",
      effectiveDate: "",
    });
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        resetForm();
      }
      setDialogOpen(open);
    },
    [resetForm]
  );

  const handleChange = useCallback(
    (field: keyof AddHistoryForm, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleSubmit = useCallback(() => {
    if (!form.changeType) {
      toast.error("Tipe perubahan wajib dipilih");
      return;
    }
    if (!form.description.trim()) {
      toast.error("Deskripsi wajib diisi");
      return;
    }
    if (!form.effectiveDate) {
      toast.error("Tanggal efektif wajib diisi");
      return;
    }

    const payload: Record<string, unknown> = {
      changeType: form.changeType,
      description: form.description.trim(),
      effectiveDate: form.effectiveDate,
    };
    if (form.oldValue.trim()) {
      payload.oldValue = form.oldValue.trim();
    }
    if (form.newValue.trim()) {
      payload.newValue = form.newValue.trim();
    }

    addMutation.mutate(
      { profileId: employeeId, data: payload },
      {
        onSuccess: (result) => {
          if (result.success) {
            toast.success("Riwayat berhasil ditambahkan");
            resetForm();
            setDialogOpen(false);
          } else {
            toast.error(result.error ?? "Gagal menambahkan riwayat");
          }
        },
        onError: () => {
          toast.error("Terjadi kesalahan");
        },
      }
    );
  }, [form, employeeId, addMutation, resetForm]);

  return (
    <>
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-lg">
              Riwayat Kepegawaian
            </CardTitle>
            <PermissionGate module="hr" action="edit">
              <Button
                size="sm"
                className="rounded-full gap-1.5"
                onClick={() => setDialogOpen(true)}
              >
                <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                Tambah Riwayat
              </Button>
            </PermissionGate>
          </div>
        </CardHeader>
        <CardContent>
          {/* Loading */}
          {isLoading && (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-4 w-4 rounded-full shrink-0 mt-1" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32 rounded-lg" />
                    <Skeleton className="h-3 w-48 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty */}
          {!isLoading && (!history || history.length === 0) && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ClipboardList
                weight="BoldDuotone"
                className="h-12 w-12 text-muted-foreground/40"
              />
              <p className="mt-3 text-sm text-muted-foreground">
                Belum ada riwayat kepegawaian
              </p>
            </div>
          )}

          {/* Timeline */}
          {!isLoading && history && history.length > 0 && (
            <div className="relative pl-8">
              {/* Vertical line */}
              <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />

              <div className="space-y-6">
                {history.map((entry) => (
                  <TimelineEntry key={entry.id} entry={entry} />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Add History Dialog ────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">
              Tambah Riwayat Kepegawaian
            </DialogTitle>
            <DialogDescription>
              Tambahkan catatan riwayat perubahan kepegawaian
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Change Type */}
            <div className="space-y-1.5">
              <Label className="text-sm">Tipe Perubahan</Label>
              <Select
                value={form.changeType}
                onValueChange={(v) => handleChange("changeType", v)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Pilih tipe perubahan" />
                </SelectTrigger>
                <SelectContent>
                  {CHANGE_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-sm">Deskripsi</Label>
              <Textarea
                className="rounded-xl min-h-20"
                placeholder="Deskripsikan perubahan..."
                value={form.description}
                onChange={(e) => handleChange("description", e.target.value)}
              />
            </div>

            {/* Old Value */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Nilai Lama{" "}
                <span className="text-muted-foreground">(opsional)</span>
              </Label>
              <Input
                className="rounded-xl"
                placeholder="Nilai sebelumnya"
                value={form.oldValue}
                onChange={(e) => handleChange("oldValue", e.target.value)}
              />
            </div>

            {/* New Value */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Nilai Baru{" "}
                <span className="text-muted-foreground">(opsional)</span>
              </Label>
              <Input
                className="rounded-xl"
                placeholder="Nilai baru"
                value={form.newValue}
                onChange={(e) => handleChange("newValue", e.target.value)}
              />
            </div>

            {/* Effective Date */}
            <div className="space-y-1.5">
              <Label className="text-sm">Tanggal Efektif</Label>
              <Input
                type="date"
                className="rounded-xl"
                value={form.effectiveDate}
                onChange={(e) =>
                  handleChange("effectiveDate", e.target.value)
                }
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => handleOpenChange(false)}
              disabled={addMutation.isPending}
            >
              Batal
            </Button>
            <Button
              className="rounded-full"
              onClick={handleSubmit}
              disabled={addMutation.isPending}
            >
              {addMutation.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Timeline Entry ──────────────────────────────────────────────────────────

interface TimelineEntryProps {
  entry: EmploymentHistoryItem;
}

function TimelineEntry({ entry }: TimelineEntryProps) {
  const variant = CHANGE_TYPE_VARIANT[entry.changeType] ?? "secondary";
  const label = CHANGE_TYPE_LABELS[entry.changeType] ?? entry.changeType;

  return (
    <div className="relative">
      {/* Dot */}
      <div className="absolute -left-8 top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />

      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={variant} className="rounded-full text-xs">
            {label}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatDate(entry.effectiveDate)}
          </span>
        </div>

        <p className="text-sm">{entry.description}</p>

        {(entry.oldValue || entry.newValue) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {entry.oldValue && (
              <span className="rounded-lg bg-muted px-2 py-0.5">
                {entry.oldValue}
              </span>
            )}
            {entry.oldValue && entry.newValue && (
              <ArrowRight weight="BoldDuotone" className="h-3 w-3" />
            )}
            {entry.newValue && (
              <span className="rounded-lg bg-muted px-2 py-0.5">
                {entry.newValue}
              </span>
            )}
          </div>
        )}

        {entry.creator?.fullName && (
          <p className="text-xs text-muted-foreground">
            oleh {entry.creator.fullName}
          </p>
        )}
      </div>
    </div>
  );
}
