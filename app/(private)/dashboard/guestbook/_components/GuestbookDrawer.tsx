"use client";

import { useState } from "react";
import Image from "next/image";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddCircle, Camera } from "@solar-icons/react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useCreateGuestbookEntry } from "@/hooks/use-guestbook";
import { useVenues } from "@/hooks/use-venues";

interface GuestbookDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

type GuestbookForm = {
  visitorName: string;
  showCompany: boolean;
  company: string;
  email: string;
  phoneNumber: string;
  idNumber: string;
  venueId: string;
  purpose: string;
  purposeNote: string;
  hostName: string;
  numberOfGuests: number;
  notes: string;
  visitorPhotoFile: File | null;
  visitorPhotoPreview: string;
  idPhotoFile: File | null;
  idPhotoPreview: string;
};

const EMPTY_FORM: GuestbookForm = {
  visitorName: "",
  showCompany: true,
  company: "",
  email: "",
  phoneNumber: "",
  idNumber: "",
  venueId: "",
  purpose: "other",
  purposeNote: "",
  hostName: "",
  numberOfGuests: 1,
  notes: "",
  visitorPhotoFile: null,
  visitorPhotoPreview: "",
  idPhotoFile: null,
  idPhotoPreview: "",
};

const PURPOSE_OPTIONS = [
  { value: "client_visit", label: "Kunjungan Client" },
  { value: "vendor_meeting", label: "Meeting Vendor" },
  { value: "interview", label: "Interview" },
  { value: "delivery", label: "Pengiriman" },
  { value: "other", label: "Lainnya" },
] as const;

function buildNotes(form: GuestbookForm): string | null {
  const parts: string[] = [];
  if (form.hostName.trim()) {
    parts.push(`Bertemu: ${form.hostName.trim()}`);
  }
  if (form.notes.trim()) {
    parts.push(form.notes.trim());
  }
  return parts.length > 0 ? parts.join("\n") : null;
}

export function GuestbookDrawer({ isOpen, onClose }: GuestbookDrawerProps) {
  const [form, setForm] = useState<GuestbookForm>(EMPTY_FORM);
  const createMutation = useCreateGuestbookEntry();
  const { data: venues = [] } = useVenues();

  function handleClose() {
    if (form.visitorPhotoPreview) URL.revokeObjectURL(form.visitorPhotoPreview);
    if (form.idPhotoPreview) URL.revokeObjectURL(form.idPhotoPreview);
    setForm(EMPTY_FORM);
    onClose();
  }

  function setField<K extends keyof GuestbookForm>(key: K, value: GuestbookForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function uploadPhoto(file: File): Promise<string | null> {
    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/guestbook/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => null) as { key?: string; error?: string } | null;

      if (!res.ok) {
        const message = data?.error ?? "Gagal mengupload foto.";
        toast.error(message);
        return null;
      }

      if (!data?.key) {
        toast.error("Respons upload tidak valid.");
        return null;
      }

      return data.key;
    } catch {
      toast.error("Gagal mengupload foto tamu.");
      return null;
    }
  }

  function handlePhotoChange(
    field: "visitorPhotoFile" | "idPhotoFile",
    previewField: "visitorPhotoPreview" | "idPhotoPreview",
    file: File | null
  ) {
    if (!file) {
      setForm((prev) => ({ ...prev, [field]: null, [previewField]: "" }));
      return;
    }
    const url = URL.createObjectURL(file);
    setForm((prev) => ({ ...prev, [field]: file, [previewField]: url }));
  }

  async function handleSubmit() {
    if (!form.visitorName.trim()) {
      toast.error("Nama tamu wajib diisi");
      return;
    }

    let visitorPhotoUrl: string | null = null;
    let idPhotoUrl: string | null = null;

    if (form.visitorPhotoFile) {
      visitorPhotoUrl = await uploadPhoto(form.visitorPhotoFile);
      if (!visitorPhotoUrl) return;
    }

    if (form.idPhotoFile) {
      idPhotoUrl = await uploadPhoto(form.idPhotoFile);
      if (!idPhotoUrl) return;
    }

    const result = await createMutation.mutateAsync({
      visitorName: form.visitorName.trim(),
      company: form.showCompany ? (form.company.trim() || null) : null,
      email: form.email.trim() || null,
      phoneNumber: form.phoneNumber.trim() || null,
      idNumber: form.idNumber.trim() || null,
      visitorPhotoUrl,
      idPhotoUrl,
      venueId: form.venueId || null,
      purpose: form.purpose,
      purposeNote: form.purposeNote.trim() || null,
      hostId: null,
      numberOfGuests: form.numberOfGuests,
      notes: buildNotes(form),
    });

    if (result.success) {
      toast.success("Tamu berhasil dicatat");
      handleClose();
    } else {
      toast.error(result.error ?? "Gagal mencatat tamu");
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title="Tambah Tamu"
      maxWidth="sm:max-w-lg"
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto space-y-4 pb-2">
          {/* Nama Tamu */}
          <div className="space-y-1.5">
            <Label htmlFor="gb-visitorName" className="text-sm font-medium">
              Nama Tamu <span className="text-destructive">*</span>
            </Label>
            <Input
              id="gb-visitorName"
              placeholder="Nama lengkap tamu"
              value={form.visitorName}
              onChange={(e) => setField("visitorName", e.target.value)}
              className="rounded-xl"
            />
          </div>

          {/* Perusahaan toggle + input */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="gb-showCompany"
                checked={form.showCompany}
                onCheckedChange={(checked) => {
                  setField("showCompany", checked === true);
                  if (!checked) {
                    setField("company", "");
                  }
                }}
              />
              <Label htmlFor="gb-showCompany" className="text-sm font-medium cursor-pointer">
                Dari Perusahaan / Instansi
              </Label>
            </div>
            {form.showCompany && (
              <Input
                id="gb-company"
                placeholder="Nama perusahaan atau instansi"
                value={form.company}
                onChange={(e) => setField("company", e.target.value)}
                className="rounded-xl"
              />
            )}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="gb-email" className="text-sm font-medium">
              Email
            </Label>
            <Input
              id="gb-email"
              type="email"
              placeholder="email@contoh.com"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              className="rounded-xl"
            />
          </div>

          {/* No. Telepon */}
          <div className="space-y-1.5">
            <Label htmlFor="gb-phone" className="text-sm font-medium">
              No. Telepon
            </Label>
            <Input
              id="gb-phone"
              placeholder="08xx-xxxx-xxxx"
              value={form.phoneNumber}
              onChange={(e) => setField("phoneNumber", e.target.value)}
              className="rounded-xl"
            />
          </div>

          {/* No. KTP */}
          <div className="space-y-1.5">
            <Label htmlFor="gb-idNumber" className="text-sm font-medium">
              No. KTP / ID
            </Label>
            <Input
              id="gb-idNumber"
              placeholder="Nomor identitas"
              value={form.idNumber}
              onChange={(e) => setField("idNumber", e.target.value)}
              className="rounded-xl"
            />
          </div>

          {/* Foto Tamu */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Foto Tamu</Label>
            <div className="flex items-center gap-3">
              {form.visitorPhotoPreview ? (
                <div className="relative">
                  <Image
                    src={form.visitorPhotoPreview}
                    alt="Preview foto tamu"
                    width={80}
                    height={80}
                    className="h-20 w-20 rounded-xl object-cover border"
                    unoptimized
                  />
                  <button
                    type="button"
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs"
                    onClick={() => handlePhotoChange("visitorPhotoFile", "visitorPhotoPreview", null)}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-20 w-20 rounded-xl border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors">
                  <Camera weight="BoldDuotone" className="h-5 w-5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground mt-0.5">Upload</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      handlePhotoChange("visitorPhotoFile", "visitorPhotoPreview", f);
                    }}
                  />
                </label>
              )}
              <p className="text-xs text-muted-foreground">Foto selfie tamu (opsional)</p>
            </div>
          </div>

          {/* Foto KTP */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Foto KTP</Label>
            <div className="flex items-center gap-3">
              {form.idPhotoPreview ? (
                <div className="relative">
                  <Image
                    src={form.idPhotoPreview}
                    alt="Preview foto KTP"
                    width={80}
                    height={80}
                    className="h-20 w-20 rounded-xl object-cover border"
                    unoptimized
                  />
                  <button
                    type="button"
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs"
                    onClick={() => handlePhotoChange("idPhotoFile", "idPhotoPreview", null)}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-20 w-20 rounded-xl border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors">
                  <Camera weight="BoldDuotone" className="h-5 w-5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground mt-0.5">Upload</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      handlePhotoChange("idPhotoFile", "idPhotoPreview", f);
                    }}
                  />
                </label>
              )}
              <p className="text-xs text-muted-foreground">Foto kartu identitas tamu (opsional)</p>
            </div>
          </div>

          {/* Venue */}
          <div className="space-y-1.5">
            <Label htmlFor="gb-venue" className="text-sm font-medium">
              Venue
            </Label>
            <Select
              value={form.venueId}
              onValueChange={(v) => setField("venueId", v)}
            >
              <SelectTrigger id="gb-venue" className="rounded-xl w-full">
                <SelectValue placeholder="Pilih venue (opsional)" />
              </SelectTrigger>
              <SelectContent>
                {venues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tujuan Kunjungan */}
          <div className="space-y-1.5">
            <Label htmlFor="gb-purpose" className="text-sm font-medium">
              Tujuan Kunjungan
            </Label>
            <Select
              value={form.purpose}
              onValueChange={(v) => setField("purpose", v)}
            >
              <SelectTrigger id="gb-purpose" className="rounded-xl w-full">
                <SelectValue placeholder="Pilih tujuan kunjungan" />
              </SelectTrigger>
              <SelectContent>
                {PURPOSE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Catatan Tujuan — only when purpose is "other" */}
          {form.purpose === "other" && (
            <div className="space-y-1.5">
              <Label htmlFor="gb-purposeNote" className="text-sm font-medium">
                Catatan Tujuan
              </Label>
              <Input
                id="gb-purposeNote"
                placeholder="Jelaskan tujuan kunjungan..."
                value={form.purposeNote}
                onChange={(e) => setField("purposeNote", e.target.value)}
                className="rounded-xl"
              />
            </div>
          )}

          {/* Bertemu Dengan */}
          <div className="space-y-1.5">
            <Label htmlFor="gb-hostName" className="text-sm font-medium">
              Bertemu Dengan
            </Label>
            <Input
              id="gb-hostName"
              placeholder="Nama yang ditemui"
              value={form.hostName}
              onChange={(e) => setField("hostName", e.target.value)}
              className="rounded-xl"
            />
          </div>

          {/* Jumlah Tamu */}
          <div className="space-y-1.5">
            <Label htmlFor="gb-numberOfGuests" className="text-sm font-medium">
              Jumlah Tamu
            </Label>
            <Input
              id="gb-numberOfGuests"
              type="number"
              min={1}
              value={form.numberOfGuests}
              onChange={(e) =>
                setField("numberOfGuests", Math.max(1, parseInt(e.target.value, 10) || 1))
              }
              className="rounded-xl"
            />
          </div>

          {/* Catatan */}
          <div className="space-y-1.5">
            <Label htmlFor="gb-notes" className="text-sm font-medium">
              Catatan
            </Label>
            <Textarea
              id="gb-notes"
              placeholder="Catatan tambahan..."
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              className="rounded-xl min-h-20 resize-y"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-background border-t border-border pt-4 mt-4 flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1 rounded-full"
            onClick={handleClose}
            disabled={createMutation.isPending}
          >
            Batal
          </Button>
          <Button
            type="button"
            className="flex-1 rounded-full gap-1.5"
            onClick={handleSubmit}
            disabled={createMutation.isPending || !form.visitorName.trim()}
          >
            <AddCircle weight="BoldDuotone" className="h-4 w-4" />
            {createMutation.isPending ? "Menyimpan..." : "Catat Tamu"}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
