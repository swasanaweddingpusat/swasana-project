"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useApproveProcurement } from "@/hooks/useProcurement";
import type { ProcurementItem } from "@/lib/queries/procurement";
import type { ApproveProcurementInput } from "@/lib/validations/procurement";

interface ApproveProcurementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ProcurementItem | null;
  onSuccess?: () => void;
}

const ACTIONS: {
  value: ApproveProcurementInput["action"];
  label: string;
  description: string;
}[] = [
  {
    value: "APPROVE",
    label: "Setujui",
    description: "Pengajuan disetujui untuk diproses",
  },
  {
    value: "REJECT",
    label: "Tolak",
    description: "Pengajuan ditolak (wajib isi keterangan)",
  },
  {
    value: "COMPLETE",
    label: "Selesai",
    description: "Pengajuan telah selesai diproses",
  },
];

export function ApproveProcurementDialog({
  open,
  onOpenChange,
  item,
  onSuccess,
}: ApproveProcurementDialogProps): React.JSX.Element {
  const [action, setAction] =
    useState<ApproveProcurementInput["action"]>("APPROVE");
  const [keterangan, setKeterangan] = useState("");
  const [keteranganError, setKeteranganError] = useState("");

  const { mutateAsync, isPending } = useApproveProcurement();

  function handleClose() {
    if (isPending) return;
    setAction("APPROVE");
    setKeterangan("");
    setKeteranganError("");
    onOpenChange(false);
  }

  async function handleConfirm() {
    if (action === "REJECT" && !keterangan.trim()) {
      setKeteranganError("Keterangan wajib diisi saat menolak");
      return;
    }
    if (!item) return;
    try {
      await mutateAsync({
        id: item.id,
        data: { action, keterangan: keterangan.trim() || undefined },
      });
      const label = ACTIONS.find((a) => a.value === action)?.label ?? action;
      toast.success(`Pengajuan berhasil di${label.toLowerCase()}.`);
      handleClose();
      onSuccess?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal memproses pengajuan"
      );
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tindak Pengajuan</DialogTitle>
          <DialogDescription className="truncate">
            {item?.namaBarang ?? ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <RadioGroup
            value={action}
            onValueChange={(v) =>
              setAction(v as ApproveProcurementInput["action"])
            }
            className="space-y-2"
          >
            {ACTIONS.map(({ value, label, description }) => (
              <div
                key={value}
                className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer hover:bg-muted/40 transition-colors"
              >
                <RadioGroupItem
                  value={value}
                  id={`action-${value}`}
                  className="mt-0.5"
                />
                <label
                  htmlFor={`action-${value}`}
                  className="cursor-pointer flex-1"
                >
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </label>
              </div>
            ))}
          </RadioGroup>

          {action === "REJECT" && (
            <div className="space-y-1.5">
              <Label htmlFor="approve-keterangan">Keterangan *</Label>
              <Textarea
                id="approve-keterangan"
                rows={3}
                placeholder="Alasan penolakan..."
                value={keterangan}
                onChange={(e) => {
                  setKeterangan(e.target.value);
                  if (keteranganError) setKeteranganError("");
                }}
              />
              {keteranganError && (
                <p className="text-xs text-destructive">{keteranganError}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isPending}
            className="rounded-full"
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={() => {
              void handleConfirm();
            }}
            disabled={isPending}
            className="rounded-full"
          >
            {isPending ? "Memproses..." : "Konfirmasi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
