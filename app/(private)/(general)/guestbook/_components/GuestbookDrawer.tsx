"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AddCircle, Camera, Link, CloseCircle, CheckCircle, Pen } from "@solar-icons/react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { BitrixIdField } from "@/components/shared/BitrixIdField";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCreateGuestbookEntry, useUpdateGuestbookEntry } from "@/hooks/use-guestbook";
import { useVenues } from "@/hooks/use-venues";
import { useSalesUsers } from "@/hooks/use-sales-users";
import { usePermissions } from "@/hooks/use-permissions";
import type { GuestbookEntryItem } from "@/lib/queries/guestbookEntries";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch error ${res.status}`);
  return res.json() as Promise<T>;
}

type SourceOption = { id: string; name: string; createdAt: string };
type PackageOption = { id: string; packageName: string; pax: number };

interface GuestbookDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editEntry?: GuestbookEntryItem | null;
}

type PhotoFieldKey =
  | "visitorPhotoFile"
  | "proofChatFile"
  | "proofPhotoFile"
  | "proofLostFile"
  | "proofRescheduleFile";
type PreviewFieldKey =
  | "visitorPhotoPreview"
  | "proofChatPreview"
  | "proofPhotoPreview"
  | "proofLostPreview"
  | "proofReschedulePreview";

type GuestbookForm = {
  visitorName: string;
  email: string;
  phoneNumber: string;
  venueId: string;
  interactionType: string;
  onlineMedium: string;
  meetingUrl: string;
  meetingLocation: string;
  scheduledAt: string;
  hostId: string;
  notes: string;
  visitStatus: string;
  sourceOfInformationId: string;
  packageId: string;
  packageCategory: string;
  checkInAt: string;
  commitVisitDate: string;
  commitPayDate: string;
  visitorPhotoFile: File | null;
  visitorPhotoPreview: string;
  proofChatFile: File | null;
  proofChatPreview: string;
  proofPhotoFile: File | null;
  proofPhotoPreview: string;
  proofLostFile: File | null;
  proofLostPreview: string;
  proofRescheduleFile: File | null;
  proofReschedulePreview: string;
  bitrixContactId: string;
  bitrixName: string;
  bitrixSourceInfo: string;
};

const EMPTY_FORM: GuestbookForm = {
  visitorName: "",
  email: "",
  phoneNumber: "",
  venueId: "",
  interactionType: "",
  onlineMedium: "",
  meetingUrl: "",
  meetingLocation: "",
  scheduledAt: "",
  hostId: "",
  notes: "",
  visitStatus: "",
  sourceOfInformationId: "",
  packageId: "",
  packageCategory: "",
  checkInAt: "",
  commitVisitDate: "",
  commitPayDate: "",
  visitorPhotoFile: null,
  visitorPhotoPreview: "",
  proofChatFile: null,
  proofChatPreview: "",
  proofPhotoFile: null,
  proofPhotoPreview: "",
  proofLostFile: null,
  proofLostPreview: "",
  proofRescheduleFile: null,
  proofReschedulePreview: "",
  bitrixContactId: "",
  bitrixName: "",
  bitrixSourceInfo: "",
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

function resolvePhotoUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.startsWith("http")) return key;
  const base = process.env.NEXT_PUBLIC_S3_PUBLIC_URL;
  if (!base) return null;
  return `${base}/${key}`;
}

type BitrixContact = { id: string; name: string };

function PhotoUpload({
  label,
  required,
  preview,
  onFileChange,
  onClear,
}: {
  label: string;
  required?: boolean;
  preview: string;
  onFileChange: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="flex items-center gap-3">
        {preview ? (
          <div className="relative">
            <Image
              src={preview}
              alt={label}
              width={80}
              height={80}
              className="h-20 w-20 rounded-xl object-cover border"
              unoptimized
            />
            <button
              type="button"
              className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs"
              onClick={onClear}
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
                const f = e.target.files?.[0];
                if (f) onFileChange(f);
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}

export function GuestbookDrawer({ isOpen, onClose, editEntry }: GuestbookDrawerProps) {
  const [form, setForm] = useState<GuestbookForm>(EMPTY_FORM);
  const [showConfirm, setShowConfirm] = useState(false);
  const [bitrixContacts, setBitrixContacts] = useState<BitrixContact[]>([]);
  const [bitrixLoading, setBitrixLoading] = useState(false);
  const [bitrixError, setBitrixError] = useState<string | null>(null);
  const [bitrixSearched, setBitrixSearched] = useState(false);
  const bitrixAbortRef = useRef<AbortController | null>(null);

  const isEditMode = editEntry != null;
  const createMutation = useCreateGuestbookEntry();
  const updateMutation = useUpdateGuestbookEntry();
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const { data: venues = [] } = useVenues();
  const { users: salesUsers } = useSalesUsers();
  const salesOptions = salesUsers.map((u) => ({ id: u.id, name: u.fullName ?? u.id }));
  const { can } = usePermissions();

  const canWedding = can("booking", "view");
  const canMice = can("booking-mice", "view");

  useEffect(() => {
    if (form.packageCategory) return;
    if (canWedding && !canMice) setField("packageCategory", "WEDDINGS");
    else if (canMice && !canWedding) setField("packageCategory", "MICE");
  }, [canWedding, canMice, form.packageCategory]);

  const { data: sourceOptions = [] } = useQuery({
    queryKey: ["source-of-informations"],
    queryFn: () => fetchJson<SourceOption[]>("/api/source-of-informations"),
    staleTime: 5 * 60_000,
  });

  const selectedVenueId = form.venueId;
  const selectedCategory = form.packageCategory || "WEDDINGS";
  const { data: packages = [] } = useQuery({
    queryKey: ["packages", selectedVenueId, selectedCategory],
    queryFn: () =>
      fetchJson<PackageOption[]>(
        `/api/packages?venueId=${selectedVenueId}&forBooking=true&category=${selectedCategory}`
      ),
    enabled: !!selectedVenueId && !!form.packageCategory,
    staleTime: 5 * 60_000,
  });

  const isBitrixSource =
    sourceOptions.find((o) => o.id === form.sourceOfInformationId)?.name.toLowerCase().includes("bitrix") ?? false;

  useEffect(() => {
    if (isEditMode && isOpen) {
      setForm({
        visitorName: editEntry.visitorName ?? "",
        email: editEntry.email ?? "",
        phoneNumber: editEntry.phoneNumber ?? "",
        venueId: editEntry.venueId ?? "",
        interactionType: editEntry.interactionType ?? "",
        onlineMedium: editEntry.onlineMedium ?? "",
        meetingUrl: editEntry.meetingUrl ?? "",
        meetingLocation: editEntry.meetingLocation ?? "",
        scheduledAt: editEntry.scheduledAt ? new Date(editEntry.scheduledAt).toISOString().slice(0, 16) : "",
        hostId: editEntry.host?.id ?? "",
        notes: editEntry.notes ?? "",
        visitStatus: editEntry.visitStatus ?? "",
        sourceOfInformationId: editEntry.sourceOfInformationId ?? "",
        packageId: editEntry.packageId ?? "",
        packageCategory: editEntry.package?.category ?? (canWedding ? "WEDDINGS" : "MICE"),
        checkInAt: editEntry.checkInAt ? new Date(editEntry.checkInAt).toISOString().slice(0, 16) : "",
        commitVisitDate: editEntry.commitVisitDate
          ? new Date(editEntry.commitVisitDate).toISOString().slice(0, 10) : "",
        commitPayDate: editEntry.commitPayDate
          ? new Date(editEntry.commitPayDate).toISOString().slice(0, 10) : "",
        visitorPhotoFile: null,
        visitorPhotoPreview: resolvePhotoUrl(editEntry.visitorPhotoUrl) ?? "",
        proofChatFile: null,
        proofChatPreview: resolvePhotoUrl(editEntry.proofChatUrl) ?? "",
        proofPhotoFile: null,
        proofPhotoPreview: resolvePhotoUrl(editEntry.proofPhotoUrl) ?? "",
        proofLostFile: null,
        proofLostPreview: resolvePhotoUrl(editEntry.proofLostUrl) ?? "",
        proofRescheduleFile: null,
        proofReschedulePreview: resolvePhotoUrl(editEntry.proofRescheduleUrl) ?? "",
        bitrixContactId: editEntry.bitrixContactId ?? "",
        bitrixName: editEntry.bitrixName ?? "",
        bitrixSourceInfo: editEntry.bitrixSourceInfo ?? "",
      });
    }
  }, [isOpen, isEditMode, editEntry]);

  useEffect(() => {
    const digits = form.phoneNumber.replace(/\D/g, "");
    if (digits.length < 8 || form.bitrixContactId) return;

    const timer = setTimeout(() => {
      if (bitrixAbortRef.current) bitrixAbortRef.current.abort();
      const controller = new AbortController();
      bitrixAbortRef.current = controller;
      setBitrixLoading(true);

      fetch(`/api/guestbook/bitrix-lookup?phone=${encodeURIComponent(form.phoneNumber)}`, {
        signal: controller.signal,
      })
        .then((res) => res.json() as Promise<{ contacts?: BitrixContact[]; error?: string }>)
        .then((data) => {
          setBitrixContacts(data.contacts ?? []);
          setBitrixSearched(true);
          setBitrixError(null);
          setBitrixLoading(false);
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === "AbortError") return;
          setBitrixError("Gagal menghubungi Bitrix");
          setBitrixLoading(false);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [form.phoneNumber, form.bitrixContactId]);

  function handleClose() {
    setForm(EMPTY_FORM);
    setBitrixContacts([]);
    setBitrixError(null);
    setBitrixSearched(false);
    setShowConfirm(false);
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

  function handlePhotoChange(field: PhotoFieldKey, previewField: PreviewFieldKey, file: File | null) {
    if (!file) {
      setForm((prev) => ({ ...prev, [field]: null, [previewField]: "" }));
      return;
    }
    const url = URL.createObjectURL(file);
    setForm((prev) => ({ ...prev, [field]: file, [previewField]: url }));
  }

  async function uploadPhoto(file: File): Promise<string | null> {
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/guestbook/upload", { method: "POST", body: fd });
      const data = (await res.json().catch(() => null)) as { key?: string; error?: string } | null;
      if (!res.ok) {
        const msg = data?.error ?? `Upload gagal (HTTP ${res.status})`;
        toast.error(msg);
        console.error("[uploadPhoto]", res.status, data);
        return null;
      }
      if (!data?.key) {
        toast.error("Respons upload tidak valid.");
        return null;
      }
      return data.key;
    } catch (err) {
      console.error("[uploadPhoto] network error", err);
      toast.error("Gagal mengupload foto. Periksa koneksi atau konfigurasi storage.");
      return null;
    }
  }

  async function handleBindBitrix(contact: BitrixContact) {
    setField("bitrixContactId", contact.id);
    setField("bitrixName", contact.name);
    fetch(`/api/guestbook/bitrix-source?contactId=${encodeURIComponent(contact.id)}`)
      .then((res) => res.json() as Promise<{ sourceInfo?: string | null }>)
      .then((data) => {
        if (data.sourceInfo) setField("bitrixSourceInfo", data.sourceInfo);
      })
      .catch(() => {});
  }

  function validateForm(): boolean {
    if (!form.visitorName.trim()) {
      toast.error("Nama tamu wajib diisi");
      return false;
    }
    if (!form.interactionType) {
      toast.error("Pilih tipe interaksi");
      return false;
    }
    if (form.interactionType === "online_meeting") {
      if (!form.onlineMedium) { toast.error("Pilih medium online meeting"); return false; }
      if (form.onlineMedium !== "whatsapp_call" && !form.meetingUrl.trim()) { toast.error("Link meeting wajib diisi"); return false; }
    }
    if (form.interactionType === "jemput_bola" && !form.meetingLocation.trim()) {
      toast.error("Lokasi kunjungan wajib diisi");
      return false;
    }
    if (form.interactionType === "client_visit" && !form.venueId && !form.meetingLocation.trim()) {
      toast.error("Pilih venue atau isi lokasi kunjungan");
      return false;
    }
    if (!isEditMode && !form.proofPhotoFile && !form.proofPhotoPreview) {
      toast.error("Bukti foto visit wajib diupload");
      return false;
    }
    return true;
  }

  async function handleSubmit() {
    setShowConfirm(false);

    async function resolveUrl(
      file: File | null,
      existingPreview: string,
      existingKey: string | null | undefined
    ): Promise<string | null> {
      if (file) return uploadPhoto(file);
      if (isEditMode && existingPreview) return existingKey ?? null;
      return null;
    }

    const visitorPhotoUrl = await resolveUrl(form.visitorPhotoFile, form.visitorPhotoPreview, editEntry?.visitorPhotoUrl);
    if (form.visitorPhotoFile && !visitorPhotoUrl) return;

    const proofChatUrl = await resolveUrl(form.proofChatFile, form.proofChatPreview, editEntry?.proofChatUrl);
    if (form.proofChatFile && !proofChatUrl) return;
    const proofPhotoUrl = await resolveUrl(form.proofPhotoFile, form.proofPhotoPreview, editEntry?.proofPhotoUrl);
    if (form.proofPhotoFile && !proofPhotoUrl) return;
    const proofLostUrl = await resolveUrl(form.proofLostFile, form.proofLostPreview, editEntry?.proofLostUrl);
    if (form.proofLostFile && !proofLostUrl) return;
    const proofRescheduleUrl = await resolveUrl(form.proofRescheduleFile, form.proofReschedulePreview, editEntry?.proofRescheduleUrl);
    if (form.proofRescheduleFile && !proofRescheduleUrl) return;

    const payload = {
      visitorName: form.visitorName.trim(),
      email: form.email.trim() || null,
      phoneNumber: form.phoneNumber.trim() || null,
      visitorPhotoUrl,
      venueId: form.venueId || null,
      interactionType: form.interactionType,
      onlineMedium: form.onlineMedium || null,
      meetingUrl: form.meetingUrl.trim() || null,
      meetingLocation: form.meetingLocation.trim() || null,
      scheduledAt: form.scheduledAt || null,
      hostId: form.hostId || null,
      notes: form.notes.trim() || null,
      visitStatus: form.visitStatus || null,
      sourceOfInformationId: form.sourceOfInformationId || null,
      packageId: form.packageId || null,
      checkInAt: form.checkInAt || null,
      proofChatUrl,
      proofPhotoUrl,
      proofLostUrl,
      proofRescheduleUrl,
      commitVisitDate: form.commitVisitDate || null,
      commitPayDate: form.commitPayDate || null,
      bitrixContactId: form.bitrixContactId || null,
      bitrixName: form.bitrixName || null,
      bitrixSourceInfo: form.bitrixSourceInfo || null,
    };

    if (isEditMode) {
      const result = await updateMutation.mutateAsync({ id: editEntry!.id, data: payload });
      if (result.success) {
        toast.success("Data berhasil diperbarui");
        handleClose();
      } else {
        toast.error(result.error ?? "Gagal memperbarui data");
      }
    } else {
      const result = await createMutation.mutateAsync(payload);
      if (result.success) {
        toast.success("Tamu berhasil dicatat");
        handleClose();
      } else {
        toast.error(result.error ?? "Gagal mencatat tamu");
      }
    }
  }

  function handleSubmitClick() {
    if (!validateForm()) return;
    setShowConfirm(true);
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditMode ? "Edit Data Tamu" : "Tambah Tamu"}
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

            <div className="space-y-1.5">
              <Label htmlFor="gb-checkInAt" className="text-sm font-medium">
                Tanggal & Waktu
              </Label>
              <Input
                id="gb-checkInAt"
                type="datetime-local"
                value={form.checkInAt}
                onChange={(e) => setField("checkInAt", e.target.value)}
                className="rounded-xl"
              />
              <p className="text-xs text-muted-foreground">Kosongkan untuk waktu sekarang</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Sumber</Label>
              <SearchableSelect
                options={sourceOptions.map((o) => ({ id: o.id, name: o.name }))}
                value={form.sourceOfInformationId}
                onChange={(v) => {
                  setField("sourceOfInformationId", v);
                }}
                placeholder="Pilih sumber informasi"
                searchPlaceholder="Cari sumber..."
                emptyText="Tidak ada sumber"
              />
            </div>

            {isBitrixSource && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Bitrix ID</Label>
                <BitrixIdField
                  value={form.bitrixContactId}
                  onChange={(v) => setField("bitrixContactId", v)}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="gb-email" className="text-sm font-medium">Email</Label>
              <Input
                id="gb-email"
                type="email"
                placeholder="email@contoh.com"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gb-phone" className="text-sm font-medium">No. Telepon</Label>
              <Input
                id="gb-phone"
                placeholder="08xx-xxxx-xxxx"
                value={form.phoneNumber}
                onChange={(e) => {
                  const val = e.target.value;
                  setField("phoneNumber", val);
                  if (form.bitrixContactId) {
                    setField("bitrixContactId", "");
                    setField("bitrixName", "");
                    setField("bitrixSourceInfo", "");
                  }
                  const digits = val.replace(/\D/g, "");
                  if (digits.length < 8) {
                    setBitrixContacts([]);
                    setBitrixError(null);
                    setBitrixSearched(false);
                  }
                }}
                className="rounded-xl"
              />

              {form.bitrixContactId ? (
                <div className="flex items-center gap-2 mt-1.5 px-3 py-2 rounded-xl bg-secondary border border-border">
                  <CheckCircle weight="BoldDuotone" className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{form.bitrixName}</p>
                    <p className="text-[11px] text-muted-foreground">Terhubung ke Bitrix</p>
                    {form.bitrixSourceInfo && (
                      <p className="text-[11px] text-muted-foreground">Sumber: {form.bitrixSourceInfo}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setField("bitrixContactId", "");
                      setField("bitrixName", "");
                      setField("bitrixSourceInfo", "");
                    }}
                    className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Hapus binding Bitrix"
                  >
                    <CloseCircle weight="BoldDuotone" className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  {bitrixLoading && (
                    <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                      <span className="inline-block h-3 w-3 rounded-full border-2 border-muted-foreground/40 border-t-primary animate-spin" />
                      Mencari di Bitrix...
                    </p>
                  )}
                  {bitrixError && !bitrixLoading && (
                    <p className="text-xs text-muted-foreground mt-1.5">{bitrixError}</p>
                  )}
                  {!bitrixLoading && !bitrixError && bitrixSearched && bitrixContacts.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1.5">Tidak ditemukan di Bitrix</p>
                  )}
                  {!bitrixLoading && !bitrixError && bitrixContacts.length > 0 && (
                    <div className="mt-1.5 space-y-1.5">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Link weight="BoldDuotone" className="h-3.5 w-3.5" />
                        Hubungkan ke kontak Bitrix:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {bitrixContacts.map((contact) => (
                          <button
                            key={contact.id}
                            type="button"
                            onClick={() => handleBindBitrix(contact)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-muted text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                          >
                            {contact.name}
                            <span className="text-[10px] opacity-60">#{contact.id}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <PhotoUpload
              label="Foto Tamu"
              preview={form.visitorPhotoPreview}
              onFileChange={(f) => handlePhotoChange("visitorPhotoFile", "visitorPhotoPreview", f)}
              onClear={() => handlePhotoChange("visitorPhotoFile", "visitorPhotoPreview", null)}
            />
          </div>

          {/* Section: Detail */}
          {form.interactionType && (
            <div className="space-y-4">
              <SectionLabel>Detail</SectionLabel>

              {/* Venue — semua tipe interaksi */}
              <div className="space-y-1.5">
                <Label htmlFor="gb-venue" className="text-sm font-medium">Venue</Label>
                <Select
                  value={form.venueId}
                  onValueChange={(v) => {
                    setField("venueId", v);
                    setField("packageId", "");
                  }}
                >
                  <SelectTrigger id="gb-venue" className="rounded-xl w-full">
                    <SelectValue placeholder="Pilih venue" />
                  </SelectTrigger>
                  <SelectContent>
                    {venues.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Kategori Paket — muncul kalau user punya akses wedding & mice */}
              {canWedding && canMice && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Kategori Paket</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "WEDDINGS", label: "Wedding" },
                      { value: "MICE", label: "MICE" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setField("packageCategory", opt.value);
                          setField("packageId", "");
                        }}
                        className={cn(
                          "min-h-9 rounded-full px-3 py-2 text-xs font-medium text-center transition-colors",
                          form.packageCategory === opt.value
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Paket — semua tipe interaksi, tergantung venue */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Paket</Label>
                <SearchableSelect
                  options={packages.map((p) => ({
                    id: p.id,
                    name: `${p.packageName}${p.pax ? ` — ${p.pax} pax` : ""}`,
                  }))}
                  value={form.packageId}
                  onChange={(v) => setField("packageId", v)}
                  placeholder={
                    !form.venueId
                      ? "Pilih venue terlebih dahulu"
                      : !form.packageCategory
                        ? "Pilih kategori paket"
                        : "Pilih paket"
                  }
                  searchPlaceholder="Cari paket..."
                  emptyText="Tidak ada paket"
                  disabled={!form.venueId || !form.packageCategory}
                />
              </div>

              {/* Detail per tipe interaksi */}
              {form.interactionType === "client_visit" && (
                <div className="space-y-1.5">
                  <Label htmlFor="gb-meetingLocation-visit" className="text-sm font-medium">Lokasi</Label>
                  <Input
                    id="gb-meetingLocation-visit"
                    placeholder="Isi lokasi bila di luar venue"
                    value={form.meetingLocation}
                    onChange={(e) => setField("meetingLocation", e.target.value)}
                    className="rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">Opsional bila venue sudah dipilih</p>
                </div>
              )}

              {form.interactionType === "online_meeting" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="gb-onlineMedium" className="text-sm font-medium">
                      Medium <span className="text-destructive">*</span>
                    </Label>
                    <Select value={form.onlineMedium} onValueChange={(v) => setField("onlineMedium", v)}>
                      <SelectTrigger id="gb-onlineMedium" className="rounded-xl w-full">
                        <SelectValue placeholder="Pilih medium meeting" />
                      </SelectTrigger>
                      <SelectContent>
                        {ONLINE_MEDIUM_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="gb-meetingUrl" className="text-sm font-medium">
                      Link Meeting{" "}
                      {form.onlineMedium !== "whatsapp_call" && <span className="text-destructive">*</span>}
                    </Label>
                    <Input id="gb-meetingUrl" placeholder="https://..." value={form.meetingUrl} onChange={(e) => setField("meetingUrl", e.target.value)} className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="gb-scheduledAt-online" className="text-sm font-medium">Jadwal</Label>
                    <Input id="gb-scheduledAt-online" type="datetime-local" value={form.scheduledAt} onChange={(e) => setField("scheduledAt", e.target.value)} className="rounded-xl" />
                  </div>
                </>
              )}

              {form.interactionType === "jemput_bola" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="gb-meetingLocation-jemput" className="text-sm font-medium">
                      Lokasi <span className="text-destructive">*</span>
                    </Label>
                    <Input id="gb-meetingLocation-jemput" placeholder="Lokasi kunjungan" value={form.meetingLocation} onChange={(e) => setField("meetingLocation", e.target.value)} className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="gb-scheduledAt-jemput" className="text-sm font-medium">Jadwal</Label>
                    <Input id="gb-scheduledAt-jemput" type="datetime-local" value={form.scheduledAt} onChange={(e) => setField("scheduledAt", e.target.value)} className="rounded-xl" />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Bertemu Dengan */}
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
            <p className="text-xs text-muted-foreground">Sales PIC yang ditemui — dipakai untuk atribusi</p>
          </div>

          {/* Catatan */}
          <div className="space-y-1.5">
            <Label htmlFor="gb-notes" className="text-sm font-medium">Catatan</Label>
            <Textarea
              id="gb-notes"
              placeholder="Catatan tambahan..."
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              className="rounded-xl min-h-20 resize-y"
            />
          </div>

          {/* Section: Bukti */}
          <div className="space-y-4">
            <SectionLabel>Bukti</SectionLabel>
            <PhotoUpload
              label="Bukti Foto Visit"
              required
              preview={form.proofPhotoPreview}
              onFileChange={(f) => handlePhotoChange("proofPhotoFile", "proofPhotoPreview", f)}
              onClear={() => handlePhotoChange("proofPhotoFile", "proofPhotoPreview", null)}
            />
            <PhotoUpload
              label="Bukti Chat"
              preview={form.proofChatPreview}
              onFileChange={(f) => handlePhotoChange("proofChatFile", "proofChatPreview", f)}
              onClear={() => handlePhotoChange("proofChatFile", "proofChatPreview", null)}
            />
            <PhotoUpload
              label="Bukti Lost"
              preview={form.proofLostPreview}
              onFileChange={(f) => handlePhotoChange("proofLostFile", "proofLostPreview", f)}
              onClear={() => handlePhotoChange("proofLostFile", "proofLostPreview", null)}
            />
            <PhotoUpload
              label="Bukti Reschedule"
              preview={form.proofReschedulePreview}
              onFileChange={(f) => handlePhotoChange("proofRescheduleFile", "proofReschedulePreview", f)}
              onClear={() => handlePhotoChange("proofRescheduleFile", "proofReschedulePreview", null)}
            />
          </div>

          {/* Section: Hasil */}
          <div className="space-y-4">
            <SectionLabel>Hasil</SectionLabel>
            <div className="space-y-1.5">
              <Label htmlFor="gb-visitStatus" className="text-sm font-medium">Status</Label>
              <Select value={form.visitStatus} onValueChange={(v) => setField("visitStatus", v)}>
                <SelectTrigger id="gb-visitStatus" className="rounded-xl w-full">
                  <SelectValue placeholder="Pilih status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deal">Deal</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="to_be_discuss">To Be Discuss</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Section: Komitmen */}
          <div className="space-y-4">
            <SectionLabel>Komitmen</SectionLabel>
            <div className="space-y-1.5">
              <Label htmlFor="gb-commitVisitDate" className="text-sm font-medium">Tanggal Commit Visit</Label>
              <Input
                id="gb-commitVisitDate"
                type="date"
                value={form.commitVisitDate}
                onChange={(e) => setField("commitVisitDate", e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gb-commitPayDate" className="text-sm font-medium">Tanggal Commit Bayar</Label>
              <Input
                id="gb-commitPayDate"
                type="date"
                value={form.commitPayDate}
                onChange={(e) => setField("commitPayDate", e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-background border-t border-border pt-4 mt-4 flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1 rounded-full"
            onClick={handleClose}
            disabled={isSaving}
          >
            Batal
          </Button>
          <Button
            type="button"
            className="flex-1 rounded-full gap-1.5"
            onClick={handleSubmitClick}
            disabled={isSaving || !form.visitorName.trim() || !form.interactionType}
          >
            {isEditMode ? (
              <><Pen weight="BoldDuotone" className="h-4 w-4" />{isSaving ? "Menyimpan..." : "Simpan"}</>
            ) : (
              <><AddCircle weight="BoldDuotone" className="h-4 w-4" />{isSaving ? "Menyimpan..." : "Catat Tamu"}</>
            )}
          </Button>
        </div>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isEditMode ? "Konfirmasi Ubah Data" : "Konfirmasi Tambah Data"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isEditMode
                ? "Yakin ingin menyimpan perubahan data tamu ini?"
                : "Yakin ingin menambahkan data tamu baru?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Batal</AlertDialogCancel>
            <AlertDialogAction className="rounded-full" onClick={handleSubmit}>
              {isEditMode ? "Ya, Simpan" : "Ya, Tambah"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Drawer>
  );
}
