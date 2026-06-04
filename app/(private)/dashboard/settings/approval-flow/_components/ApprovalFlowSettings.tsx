"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Route,
  AddSquare,
  TrashBinTrash,
  ArrowDown,
  ArrowUp,
  PenNewSquare,
  CheckCircle,
  Refresh,
} from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateApprovalFlow } from "@/actions/approvalFlow";
import type { ApprovalFlowsResult } from "@/lib/queries/approvalFlow";

interface Props {
  flows: ApprovalFlowsResult;
  roles: { id: string; name: string }[];
}

interface StepDraft {
  key: string;
  stepOrder: number;
  approverRoleId: string;
  label: string;
}

type FlowDraft = {
  module: string;
  label: string;
  sequential: boolean;
  steps: StepDraft[];
};

function buildDraft(flow: ApprovalFlowsResult[number]): FlowDraft {
  return {
    module: flow.module,
    label: flow.label,
    sequential: flow.sequential,
    steps: flow.steps.map((s, idx) => ({
      key: `${flow.module}-${idx}-${s.approverRoleId}`,
      stepOrder: s.stepOrder,
      approverRoleId: s.approverRoleId,
      label: s.label ?? "",
    })),
  };
}

export function ApprovalFlowSettings({ flows, roles }: Props): React.ReactElement {
  const [drafts, setDrafts] = useState<FlowDraft[]>(flows.map(buildDraft));
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [, startTransition] = useTransition();

  const activeDraft = drafts.find((d) => d.module === editingModule) ?? null;

  function updateDraft(module: string, updater: (d: FlowDraft) => FlowDraft) {
    setDrafts((prev) =>
      prev.map((d) => (d.module === module ? updater(d) : d))
    );
  }

  function openEditor(module: string) {
    setEditingModule(module);
    setDialogError("");
  }

  function closeEditor() {
    setEditingModule(null);
    setDialogError("");
  }

  function addStep(module: string) {
    updateDraft(module, (d) => ({
      ...d,
      steps: [
        ...d.steps,
        {
          key: `${module}-new-${Date.now()}`,
          stepOrder: d.steps.length + 1,
          approverRoleId: "",
          label: "",
        },
      ],
    }));
  }

  function removeStep(module: string, idx: number) {
    updateDraft(module, (d) => {
      const steps = d.steps.filter((_, i) => i !== idx).map((s, i) => ({
        ...s,
        stepOrder: i + 1,
      }));
      return { ...d, steps };
    });
  }

  function moveStep(module: string, idx: number, direction: "up" | "down") {
    updateDraft(module, (d) => {
      const steps = [...d.steps];
      const target = direction === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= steps.length) return d;
      [steps[idx], steps[target]] = [steps[target], steps[idx]];
      return {
        ...d,
        steps: steps.map((s, i) => ({ ...s, stepOrder: i + 1 })),
      };
    });
  }

  function updateStep(
    module: string,
    idx: number,
    field: "approverRoleId" | "label",
    value: string
  ) {
    updateDraft(module, (d) => {
      const steps = d.steps.map((s, i) =>
        i === idx ? { ...s, [field]: value } : s
      );
      return { ...d, steps };
    });
  }

  function handleSave() {
    if (!activeDraft) return;

    if (activeDraft.steps.length === 0) {
      setDialogError("Minimal satu step diperlukan.");
      return;
    }
    if (activeDraft.steps.some((s) => !s.approverRoleId)) {
      setDialogError("Semua step harus memiliki role.");
      return;
    }

    setDialogError("");
    setIsSaving(true);

    startTransition(async () => {
      const result = await updateApprovalFlow({
        module: activeDraft.module,
        sequential: activeDraft.sequential,
        steps: activeDraft.steps.map((s) => ({
          stepOrder: s.stepOrder,
          approverRoleId: s.approverRoleId,
          label: s.label || undefined,
        })),
      });

      setIsSaving(false);

      if (result.success) {
        toast.success(`Approval flow ${activeDraft.label} berhasil disimpan.`);
        closeEditor();
      } else {
        setDialogError(result.error ?? "Gagal menyimpan.");
        toast.error(result.error ?? "Gagal menyimpan.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 shrink-0">
          <Route weight="BoldDuotone" className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Approval Flow</h2>
          <p className="text-sm text-muted-foreground">
            Konfigurasi langkah dan role approver untuk setiap modul.
          </p>
        </div>
      </div>

      {/* Table Card */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-56">
                Modul
              </TableHead>
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-28">
                Sequential
              </TableHead>
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Steps
              </TableHead>
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-24 text-right">
                Aksi
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drafts.map((draft) => (
              <TableRow key={draft.module}>
                {/* Modul */}
                <TableCell className="px-5 py-3.5">
                  <p className="text-sm font-medium text-foreground leading-tight">
                    {draft.label}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    {draft.module}
                  </p>
                </TableCell>

                {/* Sequential Badge */}
                <TableCell className="px-4 py-3.5">
                  {draft.sequential ? (
                    <Badge
                      variant="secondary"
                      className="bg-primary/10 text-primary border-primary/20 rounded-full text-xs font-medium"
                    >
                      ON
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-muted-foreground rounded-full text-xs font-medium"
                    >
                      OFF
                    </Badge>
                  )}
                </TableCell>

                {/* Steps chips */}
                <TableCell className="px-4 py-3.5">
                  {draft.steps.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">
                      Belum ada step
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {draft.steps.map((step, idx) => {
                        const roleName =
                          roles.find((r) => r.id === step.approverRoleId)?.name ??
                          step.approverRoleId;
                        return (
                          <div key={step.key} className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-foreground">
                              <span className="flex items-center justify-center h-3.5 w-3.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0">
                                {step.stepOrder}
                              </span>
                              {roleName}
                            </span>
                            {idx < draft.steps.length - 1 && (
                              <span className="text-muted-foreground text-xs select-none">
                                →
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TableCell>

                {/* Aksi */}
                <TableCell className="px-4 py-3.5 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full gap-1.5 h-8 px-3 text-xs"
                    onClick={() => openEditor(draft.module)}
                  >
                    <PenNewSquare weight="BoldDuotone" className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingModule} onOpenChange={(open) => { if (!open) closeEditor(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {activeDraft ? `Edit Flow: ${activeDraft.label}` : "Edit Approval Flow"}
            </DialogTitle>
          </DialogHeader>

          {activeDraft && (
            <div className="space-y-4 py-1">
              {/* Sequential toggle */}
              <div className="flex items-center justify-between rounded-xl bg-secondary/50 px-4 py-3">
                <div>
                  <Label
                    htmlFor={`seq-${activeDraft.module}`}
                    className="text-sm font-medium text-foreground cursor-pointer"
                  >
                    Sequential
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Step harus disetujui urut dari step 1
                  </p>
                </div>
                <Switch
                  id={`seq-${activeDraft.module}`}
                  checked={activeDraft.sequential}
                  onCheckedChange={(val) =>
                    updateDraft(activeDraft.module, (d) => ({ ...d, sequential: val }))
                  }
                />
              </div>

              {/* Steps editor */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Steps ({activeDraft.steps.length})
                </p>

                {activeDraft.steps.length === 0 && (
                  <div className="flex items-center justify-center h-20 rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                    Belum ada step — tambahkan minimal satu.
                  </div>
                )}

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {activeDraft.steps.map((step, idx) => (
                    <div
                      key={step.key}
                      className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5"
                    >
                      <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                        {step.stepOrder}
                      </span>

                      <div className="flex-1 min-w-0">
                        <Select
                          value={step.approverRoleId}
                          onValueChange={(val) =>
                            updateStep(activeDraft.module, idx, "approverRoleId", val)
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Pilih role..." />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveStep(activeDraft.module, idx, "up")}
                          disabled={idx === 0}
                          className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Naikkan"
                        >
                          <ArrowUp weight="BoldDuotone" className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveStep(activeDraft.module, idx, "down")}
                          disabled={idx === activeDraft.steps.length - 1}
                          className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Turunkan"
                        >
                          <ArrowDown weight="BoldDuotone" className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeStep(activeDraft.module, idx)}
                          className="rounded-md p-1 text-destructive hover:bg-destructive/10"
                          title="Hapus step"
                        >
                          <TrashBinTrash weight="BoldDuotone" className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => addStep(activeDraft.module)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1 px-1"
                >
                  <AddSquare weight="BoldDuotone" className="size-3.5" />
                  Tambah step
                </button>
              </div>

              {dialogError && (
                <p className="text-xs text-destructive">{dialogError}</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={closeEditor}
              disabled={isSaving}
            >
              Batal
            </Button>
            <Button
              size="sm"
              className="rounded-full gap-1.5"
              onClick={handleSave}
              disabled={isSaving || !activeDraft}
            >
              {isSaving ? (
                <>
                  <Refresh weight="BoldDuotone" className="size-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <CheckCircle weight="BoldDuotone" className="size-4" />
                  Simpan Perubahan
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
