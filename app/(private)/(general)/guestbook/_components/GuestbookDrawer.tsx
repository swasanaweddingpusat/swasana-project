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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCreateGuestbookEntry } from "@/hooks/use-guestbook";
import { useVenues } from "@/hooks/use-venues";
import { useSalesUsers } from "@/hooks/use-sales-users";

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
  interactionType: string;
  onlineMedium: string;
  meetingUrl: string;
  meetingLocation: string;
  scheduledAt: string;
  hostId: string;
  numberOfGuests: number;
  notes: string;
  visitStatus: string;
  notJoinReason: string;
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
  interactionType: "",
  onlineMedium: "",
  meetingUrl: "",
  meetingLocation: "",
  scheduledAt: "",
  hostId: "",
  numberOfGuests: 1,
  notes: "",
  visitStatus: "",
  notJoinReason: "",
  visitorPhotoFile: null,
  visitorPhotoPreview: "",
  idPhotoFile: null,
  idPhotoPreview: "",
};

const INTERACTION_TYPE_OPTIONS = [
  { value: "client_visit", label: "Kunjungan Client" },
  { value: "online_meeting", label: "Online Meeting" },
  { value: "jemput_bola", label: "Jemput Bola" },
] as const;

const ONLINE_MEDIUM_OPTIONS = [
  { value: "zoom", label: "Zoom" },
  { value: "google_meet", label: "Google Meet" },
  { value: "whatsapp_call", label: "WhatsApp Call" },
  { value: "microsoft_teams", label: "Microsoft Teams" },
  { value: "other", label: "Lainnya" },
] as const;

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
      {children}
    </p>
  );
}

export function GuestbookDrawer({ isOpen, onClose }: GuestbookDrawerProps) {
  const [form, setForm] = useState<GuestbookForm>(EMPTY_FORM);
  const createMutation = useCreateGuestbookEntry();
  const { data: venues = [] } = useVenues();
  const { users: salesUsers } = useSalesUsers();
  const salesOptions = salesUsers.map((u) => ({ id: u.id, name: u.fullName ?? u.id }));

  function handleClose() {
    if (form.visitorPhotoPreview) URL.revokeObjectURL(form.visitorPhotoPreview);
    if (form.idPhotoPreview) URL.revokeObjectURL(form.idPhotoPreview);
    setForm(EMPTY_FORM);
    onClose();
  }

  function setField<K extends keyof GuestbookForm>(key: K, value: GuestbookForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setInteractionType(value: string) {
    setForm((prev) => ({
      ...prev,
      interactionType: value,
      onlineMedium: "",
      meetingUrl: "",
      meetingLocation: "",
      scheduledAt: "",
    }));
  }

  async function uploadPhoto(file: File): Promise<string | null> {
    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/guestbook/upload", { method: "POST", body: fd });
      const data = (await res.json().catch(() => null)) as { key?: string; error?: string } | null;

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

    if (!form.interactionType) {
      toast.error("Pilih tipe interaksi");
      return;
    }

    if (form.interactionType === "online_meeting") {
      if (!form.onlineMedium) {
        toast.error("Pilih medium online meeting");
        return;
      }
      if (form.onlineMedium !== "whatsapp_call" && !form.meetingUrl.trim()) {
        toast.error("Link meeting wajib diisi");
        return;
      }
    }

    if (form.interactionType === "jemput_bola" && !form.meetingLocation.trim()) {
      toast.error("Lokasi kunjungan wajib diisi");
      return;
    }

    if (form.interactionType === "client_visit" && !form.venueId && !form.meetingLocation.trim()) {
      toast.error("Pilih venue atau isi lokasi kunjungan");
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
      interactionType: form.interactionType,
      onlineMedium: form.onlineMedium || null,
      meetingUrl: form.meetingUrl.trim() || null,
      meetingLocation: form.meetingLocation.trim() || null,
      scheduledAt: form.scheduledAt || null,
      hostId: form.hostId || null,
      numberOfGuests: form.numberOfGuests,
      notes: form.notes.trim() || null,
      visitStatus: form.visitStatus || null,
      notJoinReason: form.visitStatus === "not_joined" ? (form.notJoinReason.trim() || null) : null,
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
        <div className="flex-1 overflow-y-auto space-y-6 pb-2">
          {/* Section: Interaksi */}
          <div className="space-y-2">
            <SectionLabel>Interaksi</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {INTERACTION_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setInteractionType(opt.value)}
                  className={cn(
                    "min-h-9 rounded-full px-2 py-2 text-xs font-medium text-center transition-colors",
                    form.interactionType === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Section: Data Tamu */}
          <div className="space-y-4">
            <SectionLabel>Data Tamu</SectionLabel>

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
          </div>

          {/* Section: Detail — conditional on interactionType */}
          {form.interactionType && (
            <div className="space-y-4">
              <SectionLabel>Detail</SectionLabel>

              {form.interactionType === "client_visit" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="gb-venue" className="text-sm font-medium">
                      Venue
                    </Label>
                    <Select
                      value={form.venueId}
                      onValueChange={(v) => setField("venueId", v)}
                    >
                      <SelectTrigger id="gb-venue" className="rounded-xl w-full">
                        <SelectValue placeholder="Pilih venue" />
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
                  <div className="space-y-1.5">
                    <Label htmlFor="gb-meetingLocation-visit" className="text-sm font-medium">
                      Lokasi
                    </Label>
                    <Input
                      id="gb-meetingLocation-visit"
                      placeholder="Isi lokasi bila di luar venue"
                      value={form.meetingLocation}
                      onChange={(e) => setField("meetingLocation", e.target.value)}
                      className="rounded-xl"
                    />
                    <p className="text-xs text-muted-foreground">
                      Opsional bila venue sudah dipilih
                    </p>
                  </div>
                </>
              )}

              {form.interactionType === "online_meeting" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="gb-onlineMedium" className="text-sm font-medium">
                      Medium <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={form.onlineMedium}
                      onValueChange={(v) => setField("onlineMedium", v)}
                    >
                      <SelectTrigger id="gb-onlineMedium" className="rounded-xl w-full">
                        <SelectValue placeholder="Pilih medium meeting" />
                      </SelectTrigger>
                      <SelectContent>
                        {ONLINE_MEDIUM_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="gb-meetingUrl" className="text-sm font-medium">
                      Link Meeting{" "}
                      {form.onlineMedium !== "whatsapp_call" && (
                        <span className="text-destructive">*</span>
                      )}
                    </Label>
                    <Input
                      id="gb-meetingUrl"
                      placeholder="https://..."
                      value={form.meetingUrl}
                      onChange={(e) => setField("meetingUrl", e.target.value)}
                      className="rounded-xl"
                    />
                    <p className="text-xs text-muted-foreground">
                      Kecuali WA Call
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="gb-scheduledAt-online" className="text-sm font-medium">
                      Jadwal
                    </Label>
                    <Input
                      id="gb-scheduledAt-online"
                      type="datetime-local"
                      value={form.scheduledAt}
                      onChange={(e) => setField("scheduledAt", e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                </>
              )}

              {form.interactionType === "jemput_bola" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="gb-meetingLocation-jemput" className="text-sm font-medium">
                      Lokasi <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="gb-meetingLocation-jemput"
                      placeholder="Lokasi kunjungan"
                      value={form.meetingLocation}
                      onChange={(e) => setField("meetingLocation", e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="gb-scheduledAt-jemput" className="text-sm font-medium">
                      Jadwal
                    </Label>
                    <Input
                      id="gb-scheduledAt-jemput"
                      type="datetime-local"
                      value={form.scheduledAt}
                      onChange={(e) => setField("scheduledAt", e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Bertemu Dengan — Sales PIC picker (atribusi) */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Bertemu Dengan</Label>
            <SearchableSelect
              options={salesOptions}
              value={form.hostId}
              onChange={(v) => setField("hostId", v)}
              placeholder="Pilih sales yang ditemui"
              searchPlaceholder="Cari sales..."
              emptyText="Tidak ada sales"
            />
            <p className="text-xs text-muted-foreground">
              Sales PIC yang ditemui — dipakai untuk atribusi
            </p>
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

          {/* Section: Hasil */}
          <div className="space-y-4">
            <SectionLabel>Hasil</SectionLabel>

            <div className="space-y-1.5">
              <Label htmlFor="gb-visitStatus" className="text-sm font-medium">
                Visit Status
              </Label>
              <Select
                value={form.visitStatus}
                onValueChange={(v) => setField("visitStatus", v)}
              >
                <SelectTrigger id="gb-visitStatus" className="rounded-xl w-full">
                  <SelectValue placeholder="Pilih status kunjungan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deal">Deal</SelectItem>
                  <SelectItem value="to_be_discuss">To Be Discuss</SelectItem>
                  <SelectItem value="not_joined">Not Joined</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.visitStatus === "not_joined" && (
              <div className="space-y-1.5">
                <Label htmlFor="gb-notJoinReason" className="text-sm font-medium">
                  Alasan Tidak Bergabung
                </Label>
                <Textarea
                  id="gb-notJoinReason"
                  placeholder="Jelaskan alasan..."
                  value={form.notJoinReason}
                  onChange={(e) => setField("notJoinReason", e.target.value)}
                  className="rounded-xl min-h-16 resize-y"
                />
              </div>
            )}
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
            disabled={createMutation.isPending || !form.visitorName.trim() || !form.interactionType}
          >
            <AddCircle weight="BoldDuotone" className="h-4 w-4" />
            {createMutation.isPending ? "Menyimpan..." : "Catat Tamu"}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
