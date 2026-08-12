"use client";

import React, { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { PhoneInput } from "@/components/shared/PhoneInput";
import { cn } from "@/lib/utils";
import {
  CalendarDate,
  User,
  Phone,
  Notes,
  UsersGroupRounded,
  Refresh,
  Camera,
  CalendarMark,
  Streets,
  Case,
} from "@solar-icons/react";
import { useLeadStatuses } from "@/hooks/use-lead-statuses";
import { useDailyActivitySegments, useCreateDailyActivitySegment } from "@/hooks/use-daily-activity-segments";
import { useSalesUsers } from "@/hooks/use-sales-users";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useCreateDailyActivity } from "@/hooks/use-daily-activities";
import { SectionHeader } from "./daily-activity-form-fields";

// ─── Types ────────────────────────────────────────────────────────────────────

// Daily Activity is MICE-only. Category is fixed to "MICE" for every new row.

interface CreateDailyActivityFormState {
  name: string;
  email: string;
  address: string;
  sourceOfInformationId: string;
  assignedToId: string;
  statusId: string;
  notes: string;
  bitrixId: string;
  segmentId: string;
  picName: string;
  picPhone: string;
  // ── MICE prospecting fields (dipindah dari Google Sheet "Daily Activity MICE") ──
  instagramUrl: string; // handle / URL IG prospek
  siteVisitDate: string; // "YYYY-MM-DD" jadwal kunjungan venue
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_FORM: CreateDailyActivityFormState = {
  name: "",
  email: "",
  address: "",
  sourceOfInformationId: "",
  assignedToId: "",
  statusId: "",
  notes: "",
  bitrixId: "",
  segmentId: "",
  picName: "",
  picPhone: "",
  instagramUrl: "",
  siteVisitDate: "",
};

// Sub-components are imported from ./daily-activity-form-fields

// ─── Props ────────────────────────────────────────────────────────────────────

interface CreateDailyActivityDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CreateDailyActivityDrawer({ open, onOpenChange, onSuccess }: CreateDailyActivityDrawerProps) {
  // ── Form state ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState<CreateDailyActivityFormState>(DEFAULT_FORM);

  // ── MICE segment options (normalized master, FK-backed) ──────────────────────
  const { data: masterSegments = [] } = useDailyActivitySegments();
  const createSegment = useCreateDailyActivitySegment();
  const miceSegments = masterSegments
    .filter((s) => s.isActive)
    .map((s) => ({ id: s.id, name: s.name }));

  // ── Site visit date popover ────────────────────────────────────────────────
  const [siteVisitDateOpen, setSiteVisitDateOpen] = useState(false);

  // ── Submit state ───────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Per-field validation errors returned by the server action (Zod fieldErrors).
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // ── Data hooks ─────────────────────────────────────────────────────────────
  const { data: leadStatuses = [] } = useLeadStatuses();
  const { users: salesUsers } = useSalesUsers();
  const { user: currentUser } = useCurrentUser();
  const createLead = useCreateDailyActivity();

  // ── Sales PIC lock ───────────────────────────────────────────────────────────
  // When the logged-in user is a sales rep, the PIC is forced to themselves and
  // locked. AssignableSalesUser.id and session.user.profileId are both profile ids.
  const isSalesRole =
    currentUser?.roleName === "sales" || currentUser?.roleName === "sales-mice";
  const isSelfAssignableSales =
    isSalesRole &&
    !!currentUser?.profileId &&
    salesUsers.some((u) => u.id === currentUser.profileId);

  // Force assignedToId to the sales rep once the drawer is open and data is ready.
  useEffect(() => {
    if (!open || !isSelfAssignableSales || !currentUser?.profileId) return;
    setForm((prev) =>
      prev.assignedToId === currentUser.profileId
        ? prev
        : { ...prev, assignedToId: currentUser.profileId! },
    );
  }, [open, isSelfAssignableSales, currentUser?.profileId]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const statusOptions = leadStatuses.map((s) => ({ id: s.id, name: s.name }));
  const salesOptions = salesUsers.map((u) => ({
    id: u.id,
    name: u.fullName ?? u.id,
  }));

  // Source of informations — fetched inline (no hook exists, quick fetch)
  const [sources, setSources] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    fetch("/api/source-of-informations")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { if (Array.isArray(data)) setSources(data); })
      .catch(() => {});
  }, []);

  // Inline-add a new source of information from the drawer (sales users included).
  async function handleAddSource(name: string) {
    const res = await fetch("/api/source-of-informations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(err.error ?? "Gagal menambah sumber informasi");
    }
    const created = await res.json() as { id: string; name: string };
    setSources((prev) => (prev.some((s) => s.id === created.id) ? prev : [created, ...prev]));
    setField("sourceOfInformationId", created.id);
  }

  const isBitrixSource =
    sources.find((s) => s.id === form.sourceOfInformationId)
      ?.name.toLowerCase()
      .includes("bitrix") ?? false;

  const isIncomplete =
    !form.name.trim() ||
    !form.picName.trim() || !form.picPhone.trim() ||
    !form.sourceOfInformationId ||
    !form.assignedToId ||
    !form.statusId ||
    (isBitrixSource && !form.bitrixId.trim());

  // ── Handlers ───────────────────────────────────────────────────────────────

  const setField = useCallback(<K extends keyof CreateDailyActivityFormState>(
    key: K,
    value: CreateDailyActivityFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear this field's inline error as soon as the user edits it.
    setFieldErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  }, []);

  function resetForm() {
    setForm(DEFAULT_FORM);
    setSubmitError(null);
    setFieldErrors({});
  }

  function handleClose() {
    resetForm();
    onOpenChange(false);
  }

  async function handleSubmit() {
    if (isIncomplete || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    setFieldErrors({});

    try {
      const result = await createLead.mutateAsync({
        name: form.name.trim(),
        contactNumbers: [{ label: form.picName.trim(), number: form.picPhone.trim().replace(/\D/g, "") }],
        email: form.email || undefined,
        address: form.address || undefined,
        instagramUrl: form.instagramUrl || undefined,
        siteVisitDate: form.siteVisitDate || undefined,
        eventDateAlt: null,
        notes: form.notes || undefined,
        segmentId: form.segmentId || undefined,
        category: "MICE",
        venueSecondaryId: null,
        packageId: null,
        eventTypeId: "",
        sourceOfInformationId: form.sourceOfInformationId,
        assignedToId: form.assignedToId,
        statusId: form.statusId,
        weddingSessionAlt: null,
        bitrixId: isBitrixSource ? (form.bitrixId || null) : null,
        isDateLocked: false,
        bookingFeeAmount: null,
        bookingFeeDate: null,
        bookingFeeEvidenceUrl: null,
      });

      if (!result.success) {
        setSubmitError(result.error ?? "Gagal menyimpan activity.");
        if ("fieldErrors" in result && result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
        return;
      }

      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Terjadi kesalahan. Silakan coba lagi.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Drawer
      isOpen={open}
      onClose={handleClose}
      title="Tambah Activity Baru"
      maxWidth="sm:max-w-lg"
    >
      <div className="flex flex-col h-full">
        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-6 pb-4">

            {/* ── SECTION: Informasi Client ─────────────────────── */}
            <div className="flex flex-col gap-4">
              <SectionHeader icon={User} title="Informasi Client" />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  Perusahaan / Instansi
                  <span className="text-destructive ml-0.5">*</span>
                </label>
                <Input
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="e.g. PT Maju Bersama"
                  className="rounded-xl"
                />
                {fieldErrors.name && (
                  <p className="text-xs text-destructive">{fieldErrors.name}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  Segment / Kategori
                  <span className="ml-1.5 font-normal text-muted-foreground text-xs">(opsional)</span>
                </label>
                <SearchableSelect
                  options={miceSegments}
                  value={form.segmentId}
                  onChange={(id) => setField("segmentId", id)}
                  onAdd={async (name) => {
                    const created = await createSegment.mutateAsync({
                      name: name.trim(),
                      isActive: true,
                      sortOrder: 0,
                    });
                    setField("segmentId", created.id);
                  }}
                  placeholder="Pilih atau tambah segment..."
                  searchPlaceholder="Cari segment..."
                  emptyText="Belum ada segment"
                  addingLabel="Menambahkan..."
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Email</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  placeholder="nama@email.com (opsional)"
                  className="rounded-xl"
                />
              </div>
            </div>

            {/* ── SECTION: Kontak ───────────────────────────────── */}
            <div className="flex flex-col gap-4">
              <SectionHeader icon={Phone} title="Kontak (HP / WA)" />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  Nama PIC / Client <span className="text-destructive">*</span>
                </label>
                <Input
                  value={form.picName}
                  onChange={(e) => setField("picName", e.target.value)}
                  placeholder="Nama penanggung jawab..."
                  className="rounded-xl"
                />
                {fieldErrors.picName && (
                  <p className="text-xs text-destructive">{fieldErrors.picName}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  No. HP / WA <span className="text-destructive">*</span>
                </label>
                <PhoneInput
                  value={form.picPhone}
                  onChange={(v) => setField("picPhone", v)}
                  maxNationalDigits={13}
                  wrapperClassName="rounded-xl"
                />
                {fieldErrors.picPhone && (
                  <p className="text-xs text-destructive">{fieldErrors.picPhone}</p>
                )}
              </div>
            </div>

            {/* ── SECTION: Prospek & Penawaran ──────────────────────
                Field yang dipindahkan dari Google Sheet "Daily Activity
                MICE": lokasi kantor, Instagram, jadwal site visit. ──── */}
            <div className="flex flex-col gap-4">
              <SectionHeader icon={Case} title="Prospek & Penawaran" />

              {/* Lokasi / Alamat kantor prospek */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Streets weight="BoldDuotone" className="h-3.5 w-3.5 text-muted-foreground" />
                  Lokasi / Alamat Kantor
                </label>
                <Textarea
                  value={form.address}
                  onChange={(e) => setField("address", e.target.value)}
                  placeholder="e.g. Cibis 9, Cilandak, Jakarta Selatan (opsional)"
                  rows={2}
                  className="rounded-xl resize-none"
                />
              </div>

              {/* Instagram prospek */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Camera weight="BoldDuotone" className="h-3.5 w-3.5 text-muted-foreground" />
                  Instagram
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                    @
                  </span>
                  <Input
                    value={form.instagramUrl}
                    onChange={(e) => setField("instagramUrl", e.target.value)}
                    placeholder="username atau link instagram (opsional)"
                    className="rounded-xl pl-7"
                  />
                </div>
                {fieldErrors.instagramUrl && (
                  <p className="text-xs text-destructive">{fieldErrors.instagramUrl}</p>
                )}
                <p className="text-[10px] text-muted-foreground">
                  Boleh isi username (mis. cosmaxindonesia) atau tempel link lengkap.
                </p>
              </div>

              {/* Jadwal Site Visit */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <CalendarMark weight="BoldDuotone" className="h-3.5 w-3.5 text-muted-foreground" />
                  Jadwal Site Visit
                </label>
                <Popover open={siteVisitDateOpen} onOpenChange={setSiteVisitDateOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal rounded-xl",
                          !form.siteVisitDate && "text-muted-foreground",
                        )}
                      >
                        <CalendarDate weight="BoldDuotone" className="mr-2 h-4 w-4 shrink-0" />
                        {form.siteVisitDate
                          ? format(
                              new Date(form.siteVisitDate + "T00:00:00"),
                              "d MMMM yyyy",
                              { locale: localeId },
                            )
                          : "Pilih tanggal kunjungan... (opsional)"}
                      </Button>
                    }
                  />
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      captionLayout="dropdown"
                      selected={
                        form.siteVisitDate
                          ? new Date(form.siteVisitDate + "T00:00:00")
                          : undefined
                      }
                      onSelect={(date) => {
                        if (date) {
                          const y = date.getFullYear();
                          const m = String(date.getMonth() + 1).padStart(2, "0");
                          const d = String(date.getDate()).padStart(2, "0");
                          setField("siteVisitDate", `${y}-${m}-${d}`);
                        } else {
                          setField("siteVisitDate", "");
                        }
                        setSiteVisitDateOpen(false);
                      }}
                      fromYear={new Date().getFullYear() - 1}
                      toYear={new Date().getFullYear() + 5}
                      defaultMonth={
                        form.siteVisitDate
                          ? new Date(form.siteVisitDate + "T00:00:00")
                          : new Date()
                      }
                    />
                    {form.siteVisitDate && (
                      <div className="border-t p-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs text-muted-foreground"
                          onClick={() => {
                            setField("siteVisitDate", "");
                            setSiteVisitDateOpen(false);
                          }}
                        >
                          Hapus tanggal
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* ── SECTION: Sales & Pipeline ─────────────────────── */}
            <div className="flex flex-col gap-4">
              <SectionHeader icon={UsersGroupRounded} title="Sales & Pipeline" />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  Sumber Informasi <span className="text-destructive">*</span>
                </label>
                <SearchableSelect
                  options={sources}
                  value={form.sourceOfInformationId}
                  onChange={(v) => {
                    setField("sourceOfInformationId", v);
                    const isBitrix =
                      sources.find((s) => s.id === v)
                        ?.name.toLowerCase()
                        .includes("bitrix") ?? false;
                    if (!isBitrix) setField("bitrixId", "");
                  }}
                  onAdd={handleAddSource}
                  placeholder="Pilih atau tambah sumber..."
                  searchPlaceholder="Cari atau tambah sumber..."
                  emptyText="Belum ada sumber"
                  addingLabel="Menambahkan..."
                />
              </div>

              {isBitrixSource && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">
                    Bitrix ID <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={form.bitrixId}
                    onChange={(e) => setField("bitrixId", e.target.value)}
                    placeholder="e.g. 12345"
                    className="rounded-xl"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  Sales PIC <span className="text-destructive">*</span>
                </label>
                <SearchableSelect
                  options={salesOptions}
                  value={form.assignedToId}
                  onChange={(v) => setField("assignedToId", v)}
                  placeholder="Pilih sales PIC..."
                  searchPlaceholder="Cari sales..."
                  emptyText="Sales tidak ditemukan"
                  disabled={isSelfAssignableSales}
                />
                {isSelfAssignableSales && (
                  <p className="text-xs text-muted-foreground">
                    Activity otomatis ditugaskan ke Anda.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  Status Pipeline <span className="text-destructive">*</span>
                </label>
                <SearchableSelect
                  options={statusOptions}
                  value={form.statusId}
                  onChange={(v) => setField("statusId", v)}
                  placeholder="Pilih status..."
                  searchPlaceholder="Cari status..."
                  emptyText="Tidak ada status"
                />
              </div>
            </div>

            {/* ── SECTION: Catatan ──────────────────────────────── */}
            <div className="flex flex-col gap-4">
              <SectionHeader icon={Notes} title="Catatan" />
              <Textarea
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                rows={3}
                placeholder="Catatan tambahan mengenai activity ini (opsional)..."
                className="rounded-xl resize-none"
              />
            </div>
          </div>
        </div>

        {/* ── Sticky footer ── */}
        <div className="sticky bottom-0 bg-background pt-4 border-t border-border mt-2">
          {submitError && (
            <p className="mb-3 text-xs text-destructive text-center">{submitError}</p>
          )}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 rounded-full"
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isIncomplete || isSubmitting}
              className="flex-1 rounded-full"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Refresh weight="BoldDuotone" className="h-4 w-4 animate-spin" />
                  Menyimpan...
                </span>
              ) : (
                "Simpan Activity"
              )}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
