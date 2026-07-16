"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AddCircle } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Drawer } from "@/components/shared/drawer";
import { useCreateOnboardingTemplate } from "@/hooks/use-onboarding";

type TemplateForm = {
  name: string;
  description: string;
  isDefault: boolean;
};

const INITIAL_FORM: TemplateForm = {
  name: "",
  description: "",
  isDefault: false,
};

interface OnboardingTemplateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OnboardingTemplateDrawer({ isOpen, onClose }: OnboardingTemplateDrawerProps) {
  const [form, setForm] = useState<TemplateForm>(INITIAL_FORM);
  const createTemplateMutation = useCreateOnboardingTemplate();

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("Nama template wajib diisi");
      return;
    }

    const result = await createTemplateMutation.mutateAsync({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      isDefault: form.isDefault,
    });

    if (result.success) {
      toast.success("Template onboarding dibuat");
      setForm(INITIAL_FORM);
      onClose();
      return;
    }

    toast.error(result.error ?? "Gagal membuat template");
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Buat Template Onboarding" maxWidth="sm:max-w-md">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="drawer-template-name">Nama template</Label>
          <Input
            id="drawer-template-name"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Onboarding karyawan baru"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="drawer-template-description">Deskripsi</Label>
          <Textarea
            id="drawer-template-description"
            rows={4}
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Checklist dokumen, orientasi, dan review awal"
          />
        </div>
        <label className="flex items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(event) => setForm((current) => ({ ...current, isDefault: event.target.checked }))}
            className="h-4 w-4 rounded border-border text-primary"
          />
          Jadikan template default
        </label>
        <Button
          className="w-full rounded-full gap-2"
          onClick={handleSubmit}
          disabled={createTemplateMutation.isPending}
        >
          <AddCircle weight="BoldDuotone" className="h-4 w-4" />
          Buat template
        </Button>
      </div>
    </Drawer>
  );
}
