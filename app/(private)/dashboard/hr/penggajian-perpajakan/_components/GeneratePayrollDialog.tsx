"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useGeneratePayroll } from "@/hooks/use-payroll-periods";

// ─── Constants ──────────────────────────────────────────────────────────────

const MONTHS = [
  { value: "1", label: "Januari" },
  { value: "2", label: "Februari" },
  { value: "3", label: "Maret" },
  { value: "4", label: "April" },
  { value: "5", label: "Mei" },
  { value: "6", label: "Juni" },
  { value: "7", label: "Juli" },
  { value: "8", label: "Agustus" },
  { value: "9", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
];

// ─── Props ──────────────────────────────────────────────────────────────────

interface GeneratePayrollDialogProps {
  open: boolean;
  onClose: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function GeneratePayrollDialog({ open, onClose }: GeneratePayrollDialogProps) {
  const currentDate = new Date();
  const [month, setMonth] = useState(String(currentDate.getMonth() + 1));
  const [year, setYear] = useState(String(currentDate.getFullYear()));

  const generateMutation = useGeneratePayroll();

  const handleGenerate = useCallback(() => {
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);

    if (!monthNum || monthNum < 1 || monthNum > 12) {
      toast.error("Bulan tidak valid");
      return;
    }
    if (!yearNum || yearNum < 2020 || yearNum > 2100) {
      toast.error("Tahun tidak valid");
      return;
    }

    generateMutation.mutate(
      { month: monthNum, year: yearNum },
      {
        onSuccess: (result) => {
          if (result.success && result.data) {
            toast.success(result.data.message);
            onClose();
          } else {
            toast.error(result.error ?? "Gagal generate payroll");
          }
        },
        onError: () => toast.error("Terjadi kesalahan saat generate payroll"),
      },
    );
  }, [month, year, generateMutation, onClose]);

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Generate Payroll</DialogTitle>
          <DialogDescription>
            Pilih bulan dan tahun untuk generate payroll. Proses ini akan
            menghitung gaji seluruh karyawan aktif.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="gen-month">Bulan</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger id="gen-month" className="rounded-xl">
                <SelectValue placeholder="Pilih bulan" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="gen-year">Tahun</Label>
            <Input
              id="gen-year"
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="rounded-xl"
              min={2020}
              max={2100}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            className="rounded-full"
            onClick={onClose}
            disabled={generateMutation.isPending}
          >
            Batal
          </Button>
          <Button
            className="rounded-full"
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? "Generating..." : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
