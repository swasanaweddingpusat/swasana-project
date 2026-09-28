"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AddCircle, Copy, CheckCircle, Link } from "@solar-icons/react";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateOnboardingFormLink } from "@/hooks/use-employee-onboarding";

interface OnboardingFormLinkDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

type SuccessData = {
  token: string;
  accessCode: string;
};

const EXPIRY_OPTIONS = [
  { value: "7", label: "7 hari" },
  { value: "14", label: "14 hari" },
  { value: "30", label: "30 hari" },
  { value: "60", label: "60 hari" },
  { value: "90", label: "90 hari" },
];

export function OnboardingFormLinkDrawer({
  isOpen,
  onClose,
}: OnboardingFormLinkDrawerProps) {
  const [name, setName] = useState("");
  const [expiryDays, setExpiryDays] = useState("30");
  const [successData, setSuccessData] = useState<SuccessData | null>(null);

  const createMutation = useCreateOnboardingFormLink();

  function resetForm() {
    setName("");
    setExpiryDays("30");
    setSuccessData(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Nama onboarding wajib diisi");
      return;
    }

    const result = await createMutation.mutateAsync({
      name: name.trim(),
      expiryDays: parseInt(expiryDays, 10),
    });

    if (result.success && result.data) {
      setSuccessData(result.data);
      return;
    }

    toast.error(result.error ?? "Gagal membuat link form");
  }

  function handleCopy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label} berhasil disalin`);
    }).catch(() => {
      toast.error(`Gagal menyalin ${label}`);
    });
  }

  const formUrl = successData
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/onboarding-form?token=${successData.token}`
    : "";

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title="Buat Link Form Onboarding"
      maxWidth="sm:max-w-md"
    >
      {successData ? (
        <div className="flex flex-col gap-5 pb-4">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-muted/30 p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-foreground">
              <CheckCircle weight="BoldDuotone" className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="font-heading text-base font-semibold text-foreground">
                Link berhasil dibuat
              </p>
              <p className="text-sm text-muted-foreground">
                Bagikan URL dan kode akses berikut kepada karyawan baru.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm text-muted-foreground">URL Form Onboarding</Label>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2">
              <Link weight="BoldDuotone" className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                {formUrl}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 shrink-0 rounded-full p-0"
                onClick={() => handleCopy(formUrl, "URL")}
              >
                <Copy weight="BoldDuotone" className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm text-muted-foreground">Kode Akses</Label>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2">
              <span className="flex-1 font-mono text-lg font-semibold tracking-widest text-foreground">
                {successData.accessCode}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 shrink-0 rounded-full p-0"
                onClick={() => handleCopy(successData.accessCode, "Kode akses")}
              >
                <Copy weight="BoldDuotone" className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="button" className="rounded-full" onClick={handleClose}>
              Tutup
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5 pb-4">
          <div className="space-y-1.5">
            <Label className="text-sm">
              Nama Onboarding
              <span className="ml-0.5 text-destructive">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Onboarding Batch Agustus 2026"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Waktu Aktif</Label>
            <Select value={expiryDays} onValueChange={setExpiryDays}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Pilih waktu aktif" />
              </SelectTrigger>
              <SelectContent>
                {EXPIRY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="outline" className="rounded-full" onClick={handleClose}>
              Batal
            </Button>
            <Button
              type="button"
              className="rounded-full gap-1.5"
              disabled={createMutation.isPending}
              onClick={handleSubmit}
            >
              <AddCircle weight="BoldDuotone" className="h-4 w-4" />
              {createMutation.isPending ? "Membuat..." : "Buat Link"}
            </Button>
          </div>
        </div>
      )}
    </Drawer>
  );
}
