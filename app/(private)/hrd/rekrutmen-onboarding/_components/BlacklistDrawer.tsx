"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AddCircle } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Drawer } from "@/components/shared/drawer";
import { useCreateBlacklistEntry } from "@/hooks/use-blacklist";

type BlacklistForm = {
  fullName: string;
  email: string;
  phoneNumber: string;
  reason: string;
};

const EMPTY_FORM: BlacklistForm = {
  fullName: "",
  email: "",
  phoneNumber: "",
  reason: "",
};

interface BlacklistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BlacklistDrawer({ isOpen, onClose }: BlacklistDrawerProps) {
  const [form, setForm] = useState<BlacklistForm>(EMPTY_FORM);
  const createBlacklistEntryMutation = useCreateBlacklistEntry();

  async function handleSubmit() {
    if (!form.fullName.trim()) {
      toast.error("Nama wajib diisi");
      return;
    }
    if (!form.reason.trim()) {
      toast.error("Alasan wajib diisi");
      return;
    }

    const result = await createBlacklistEntryMutation.mutateAsync({
      fullName: form.fullName.trim(),
      email: form.email.trim() || null,
      phoneNumber: form.phoneNumber.trim() || null,
      reason: form.reason.trim(),
    });

    if (result.success) {
      toast.success("Data berhasil ditambahkan ke blacklist");
      setForm(EMPTY_FORM);
      onClose();
      return;
    }

    toast.error(result.error ?? "Gagal menambahkan ke blacklist");
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Tambah Blacklist" maxWidth="sm:max-w-lg">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="drawer-blacklist-fullname">Nama lengkap</Label>
          <Input
            id="drawer-blacklist-fullname"
            className="rounded-xl"
            value={form.fullName}
            onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
            placeholder="Nama lengkap kandidat/karyawan"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="drawer-blacklist-email">Email <span className="text-muted-foreground">(opsional)</span></Label>
          <Input
            id="drawer-blacklist-email"
            type="email"
            className="rounded-xl"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="email@contoh.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="drawer-blacklist-phone">Nomor telepon <span className="text-muted-foreground">(opsional)</span></Label>
          <Input
            id="drawer-blacklist-phone"
            className="rounded-xl"
            value={form.phoneNumber}
            onChange={(event) => setForm((current) => ({ ...current, phoneNumber: event.target.value }))}
            placeholder="08xxxxxxxxxx"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="drawer-blacklist-reason">Alasan</Label>
          <Textarea
            id="drawer-blacklist-reason"
            rows={4}
            value={form.reason}
            onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
            placeholder="Jelaskan alasan masuk blacklist"
          />
        </div>
        <Button
          className="w-full rounded-full gap-2"
          onClick={handleSubmit}
          disabled={createBlacklistEntryMutation.isPending}
        >
          <AddCircle weight="BoldDuotone" className="h-4 w-4" />
          Tambah ke blacklist
        </Button>
      </div>
    </Drawer>
  );
}
