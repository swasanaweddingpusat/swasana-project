"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Drawer } from "@/components/shared/drawer";
import { useAssignOnboarding } from "@/hooks/use-onboarding";

type AssignmentForm = {
  profileId: string;
  templateId: string;
};

interface AssignOnboardingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Array<{ id: string; fullName: string | null }>;
  templates: Array<{ id: string; name: string }>;
}

export function AssignOnboardingDrawer({ isOpen, onClose, employees, templates }: AssignOnboardingDrawerProps) {
  const [form, setForm] = useState<AssignmentForm>({
    profileId: employees[0]?.id ?? "",
    templateId: templates[0]?.id ?? "",
  });
  const assignOnboardingMutation = useAssignOnboarding();

  async function handleSubmit() {
    if (!form.profileId || !form.templateId) {
      toast.error("Karyawan dan template wajib dipilih");
      return;
    }

    const result = await assignOnboardingMutation.mutateAsync({
      profileId: form.profileId,
      templateId: form.templateId,
    });

    if (result.success) {
      toast.success("Onboarding ditugaskan");
      onClose();
      return;
    }

    toast.error(result.error ?? "Gagal menugaskan onboarding");
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Tugaskan Onboarding" maxWidth="sm:max-w-md">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="drawer-assign-profile">Karyawan</Label>
          <select
            id="drawer-assign-profile"
            value={form.profileId}
            onChange={(event) => setForm((current) => ({ ...current, profileId: event.target.value }))}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none"
          >
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.fullName ?? "(Tanpa nama)"}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="drawer-assign-template">Template</Label>
          <select
            id="drawer-assign-template"
            value={form.templateId}
            onChange={(event) => setForm((current) => ({ ...current, templateId: event.target.value }))}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none"
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>
        <Button
          className="w-full rounded-full gap-2"
          onClick={handleSubmit}
          disabled={assignOnboardingMutation.isPending}
        >
          <ArrowRight weight="BoldDuotone" className="h-4 w-4" />
          Tugaskan onboarding
        </Button>
      </div>
    </Drawer>
  );
}
