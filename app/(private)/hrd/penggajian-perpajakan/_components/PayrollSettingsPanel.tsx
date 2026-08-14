"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  usePayrollSettings,
  useUpdatePayrollSettings,
} from "@/hooks/use-payroll-settings";
import { Settings } from "@solar-icons/react";

// ─── Form State ─────────────────────────────────────────────────────────────

interface SettingsFormState {
  pph21Method: "ter" | "progressive";
  bpjsKesCompanyRate: string;
  bpjsKesEmployeeRate: string;
  bpjsKesMaxSalary: string;
  jhtCompanyRate: string;
  jhtEmployeeRate: string;
  jkkRate: string;
  jkmRate: string;
  jpCompanyRate: string;
  jpEmployeeRate: string;
  jpMaxSalary: string;
  absenceDeductionPerDay: string;
  lateDeductionPerIncident: string;
}

const DEFAULTS: SettingsFormState = {
  pph21Method: "ter",
  bpjsKesCompanyRate: "4",
  bpjsKesEmployeeRate: "1",
  bpjsKesMaxSalary: "12000000",
  jhtCompanyRate: "3.7",
  jhtEmployeeRate: "2",
  jkkRate: "0.24",
  jkmRate: "0.3",
  jpCompanyRate: "2",
  jpEmployeeRate: "1",
  jpMaxSalary: "10042300",
  absenceDeductionPerDay: "0",
  lateDeductionPerIncident: "0",
};

function formFromSettings(settings: Record<string, unknown>): SettingsFormState {
  return {
    pph21Method: (settings.pph21Method as "ter" | "progressive") ?? "ter",
    bpjsKesCompanyRate: String(Number(settings.bpjsKesCompanyRate ?? 4)),
    bpjsKesEmployeeRate: String(Number(settings.bpjsKesEmployeeRate ?? 1)),
    bpjsKesMaxSalary: String(Number(settings.bpjsKesMaxSalary ?? 12000000)),
    jhtCompanyRate: String(Number(settings.jhtCompanyRate ?? 3.7)),
    jhtEmployeeRate: String(Number(settings.jhtEmployeeRate ?? 2)),
    jkkRate: String(Number(settings.jkkRate ?? 0.24)),
    jkmRate: String(Number(settings.jkmRate ?? 0.3)),
    jpCompanyRate: String(Number(settings.jpCompanyRate ?? 2)),
    jpEmployeeRate: String(Number(settings.jpEmployeeRate ?? 1)),
    jpMaxSalary: String(Number(settings.jpMaxSalary ?? 10042300)),
    absenceDeductionPerDay: String(Number(settings.absenceDeductionPerDay ?? 0)),
    lateDeductionPerIncident: String(Number(settings.lateDeductionPerIncident ?? 0)),
  };
}

// ─── Inner Form Component (key-based remount) ──────────────────────────────

interface SettingsFormProps {
  initialValues: SettingsFormState;
}

function SettingsForm({ initialValues }: SettingsFormProps) {
  const [form, setForm] = useState<SettingsFormState>(initialValues);
  const updateMutation = useUpdatePayrollSettings();

  const handleSave = useCallback(() => {
    const payload = {
      pph21Method: form.pph21Method,
      bpjsKesCompanyRate: parseFloat(form.bpjsKesCompanyRate) || 0,
      bpjsKesEmployeeRate: parseFloat(form.bpjsKesEmployeeRate) || 0,
      bpjsKesMaxSalary: parseFloat(form.bpjsKesMaxSalary) || 0,
      jhtCompanyRate: parseFloat(form.jhtCompanyRate) || 0,
      jhtEmployeeRate: parseFloat(form.jhtEmployeeRate) || 0,
      jkkRate: parseFloat(form.jkkRate) || 0,
      jkmRate: parseFloat(form.jkmRate) || 0,
      jpCompanyRate: parseFloat(form.jpCompanyRate) || 0,
      jpEmployeeRate: parseFloat(form.jpEmployeeRate) || 0,
      jpMaxSalary: parseFloat(form.jpMaxSalary) || 0,
      absenceDeductionPerDay: parseFloat(form.absenceDeductionPerDay) || 0,
      lateDeductionPerIncident: parseFloat(form.lateDeductionPerIncident) || 0,
    };

    updateMutation.mutate(payload, {
      onSuccess: (result) => {
        if (result.success) {
          toast.success("Pengaturan payroll berhasil disimpan");
        } else {
          toast.error(result.error ?? "Gagal menyimpan pengaturan");
        }
      },
      onError: () => toast.error("Terjadi kesalahan"),
    });
  }, [form, updateMutation]);

  const updateField = useCallback((field: keyof SettingsFormState, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {/* PPh 21 Method */}
      <div className="grid gap-2">
        <Label htmlFor="ps-pph21" className="font-medium">
          Metode Perhitungan PPh 21
        </Label>
        <Select
          value={form.pph21Method}
          onValueChange={(val) => updateField("pph21Method", val)}
        >
          <SelectTrigger id="ps-pph21" className="rounded-xl w-60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ter">TER (Tarif Efektif Rata-rata)</SelectItem>
            <SelectItem value="progressive">Progresif</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* BPJS Kesehatan */}
      <div className="rounded-xl bg-muted/50 p-4 space-y-3">
        <h3 className="font-heading text-sm font-semibold">BPJS Kesehatan</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ps-bpjs-kes-co" className="text-xs text-muted-foreground">
              Company Rate (%)
            </Label>
            <Input
              id="ps-bpjs-kes-co"
              type="number"
              value={form.bpjsKesCompanyRate}
              onChange={(e) => updateField("bpjsKesCompanyRate", e.target.value)}
              className="rounded-xl font-mono"
              min={0}
              max={100}
              step="0.01"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ps-bpjs-kes-emp" className="text-xs text-muted-foreground">
              Employee Rate (%)
            </Label>
            <Input
              id="ps-bpjs-kes-emp"
              type="number"
              value={form.bpjsKesEmployeeRate}
              onChange={(e) => updateField("bpjsKesEmployeeRate", e.target.value)}
              className="rounded-xl font-mono"
              min={0}
              max={100}
              step="0.01"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ps-bpjs-kes-max" className="text-xs text-muted-foreground">
              Max Salary (Rp)
            </Label>
            <Input
              id="ps-bpjs-kes-max"
              type="number"
              value={form.bpjsKesMaxSalary}
              onChange={(e) => updateField("bpjsKesMaxSalary", e.target.value)}
              className="rounded-xl font-mono"
              min={0}
            />
          </div>
        </div>
      </div>

      {/* BPJS Ketenagakerjaan */}
      <div className="rounded-xl bg-muted/50 p-4 space-y-3">
        <h3 className="font-heading text-sm font-semibold">BPJS Ketenagakerjaan</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ps-jht-co" className="text-xs text-muted-foreground">
              JHT Company (%)
            </Label>
            <Input
              id="ps-jht-co"
              type="number"
              value={form.jhtCompanyRate}
              onChange={(e) => updateField("jhtCompanyRate", e.target.value)}
              className="rounded-xl font-mono"
              min={0}
              max={100}
              step="0.01"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ps-jht-emp" className="text-xs text-muted-foreground">
              JHT Employee (%)
            </Label>
            <Input
              id="ps-jht-emp"
              type="number"
              value={form.jhtEmployeeRate}
              onChange={(e) => updateField("jhtEmployeeRate", e.target.value)}
              className="rounded-xl font-mono"
              min={0}
              max={100}
              step="0.01"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ps-jkk" className="text-xs text-muted-foreground">
              JKK (%)
            </Label>
            <Input
              id="ps-jkk"
              type="number"
              value={form.jkkRate}
              onChange={(e) => updateField("jkkRate", e.target.value)}
              className="rounded-xl font-mono"
              min={0}
              max={100}
              step="0.01"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ps-jkm" className="text-xs text-muted-foreground">
              JKM (%)
            </Label>
            <Input
              id="ps-jkm"
              type="number"
              value={form.jkmRate}
              onChange={(e) => updateField("jkmRate", e.target.value)}
              className="rounded-xl font-mono"
              min={0}
              max={100}
              step="0.01"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ps-jp-co" className="text-xs text-muted-foreground">
              JP Company (%)
            </Label>
            <Input
              id="ps-jp-co"
              type="number"
              value={form.jpCompanyRate}
              onChange={(e) => updateField("jpCompanyRate", e.target.value)}
              className="rounded-xl font-mono"
              min={0}
              max={100}
              step="0.01"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ps-jp-emp" className="text-xs text-muted-foreground">
              JP Employee (%)
            </Label>
            <Input
              id="ps-jp-emp"
              type="number"
              value={form.jpEmployeeRate}
              onChange={(e) => updateField("jpEmployeeRate", e.target.value)}
              className="rounded-xl font-mono"
              min={0}
              max={100}
              step="0.01"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ps-jp-max" className="text-xs text-muted-foreground">
              JP Max Salary (Rp)
            </Label>
            <Input
              id="ps-jp-max"
              type="number"
              value={form.jpMaxSalary}
              onChange={(e) => updateField("jpMaxSalary", e.target.value)}
              className="rounded-xl font-mono"
              min={0}
            />
          </div>
        </div>
      </div>

      {/* Potongan Kehadiran */}
      <div className="rounded-xl bg-muted/50 p-4 space-y-3">
        <h3 className="font-heading text-sm font-semibold">Potongan Kehadiran</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ps-absence" className="text-xs text-muted-foreground">
              Potongan per Hari Absen (Rp)
            </Label>
            <Input
              id="ps-absence"
              type="number"
              value={form.absenceDeductionPerDay}
              onChange={(e) => updateField("absenceDeductionPerDay", e.target.value)}
              className="rounded-xl font-mono"
              min={0}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ps-late" className="text-xs text-muted-foreground">
              Potongan per Keterlambatan (Rp)
            </Label>
            <Input
              id="ps-late"
              type="number"
              value={form.lateDeductionPerIncident}
              onChange={(e) => updateField("lateDeductionPerIncident", e.target.value)}
              className="rounded-xl font-mono"
              min={0}
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          className="rounded-full"
          onClick={handleSave}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? "Menyimpan..." : "Simpan Pengaturan"}
        </Button>
      </div>
    </div>
  );
}

// ─── Outer Component (key-based remount) ────────────────────────────────────

export function PayrollSettingsPanel() {
  const { data: settings, isLoading } = usePayrollSettings();

  if (isLoading) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-lg">Pengaturan Payroll</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const initialValues = settings
    ? formFromSettings(settings as unknown as Record<string, unknown>)
    : DEFAULTS;

  // Key-based remount: when settings.id changes, re-mount with fresh form state
  const remountKey = settings ? (settings as unknown as { id: string }).id : "default";

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Settings weight="BoldDuotone" className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="font-heading text-lg">Pengaturan Payroll</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <SettingsForm key={remountKey} initialValues={initialValues} />
      </CardContent>
    </Card>
  );
}
