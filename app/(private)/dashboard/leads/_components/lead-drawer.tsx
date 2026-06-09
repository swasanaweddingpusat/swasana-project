"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, startOfMonth } from "date-fns";
import { Drawer } from "@/components/shared/drawer";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Calendar as CalendarSolarIcon, CloseCircle } from "@solar-icons/react";
import { TimeRangePicker } from "@/components/shared/time-range-picker";
import { cn } from "@/lib/utils";
import {
  getWeddingTimeRange,
  type WeddingEventType,
  type WeddingSession,
} from "@/lib/constants/wedding-session-times";
import { createLeadSchema, updateLeadSchema } from "@/lib/validations/lead";
import type { CreateLeadInput } from "@/lib/validations/lead";
import type { LeadListItem, ContactNumber } from "@/types/lead";
import { useCreateLead, useUpdateLead } from "@/hooks/use-leads";
import { useVenues } from "@/hooks/use-venues";
import { useLeadStatuses } from "@/hooks/use-lead-statuses";
import { useEventTypes } from "@/hooks/use-event-types";
import { useSalesUsers } from "@/hooks/use-sales-users";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ContactEntry, parseStoredPhone } from "@/components/shared/PhoneInput";

interface LeadDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editLead: LeadListItem | null;
  onSuccess?: () => void;
}

interface LeadFormValues {
  name: string;
  instansi: string;
  email: string;
  address: string;
  category: "WEDDINGS" | "MICE";
  statusId: string;
  venueId: string;
  eventTypeId: string;
  sourceOfInformationId: string;
  assignedToId: string;
  eventDate: string;
  weddingSession: "morning" | "evening" | "fullday" | "";
  time: string;
  estimatedPax: string;
  budgetRange: string;
  notes: string;
}

type Option = { id: string; name: string };

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) return [] as unknown as T;
  return res.json();
}

const SESSION_LABELS: Record<string, string> = {
  morning: "Pagi",
  evening: "Malam",
  fullday: "Full Day",
};

/** Map event type code → WeddingEventType for time auto-fill.
 *  Only R (Resepsi) and AR (Akad & Resepsi) have standard session times.
 *  All other codes return "" (user fills manually). */
function mapCodeToWeddingEventType(code: string): WeddingEventType | "" {
  if (code === "R") return "resepsi";
  if (code === "AR") return "akad-dan-resepsi";
  if (code === "A") return "akad";
  return "";
}

const DEFAULT_VALUES: LeadFormValues = {
  name: "",
  instansi: "",
  email: "",
  address: "",
  category: "WEDDINGS",
  statusId: "",
  venueId: "",
  eventTypeId: "",
  sourceOfInformationId: "",
  assignedToId: "",
  eventDate: "",
  weddingSession: "",
  time: "",
  estimatedPax: "",
  budgetRange: "",
  notes: "",
};

// ── Draft persistence (create mode only) ──────────────────────────────────────
const LEAD_DRAFT_KEY = "lead-draft-v1";

type LeadDraft = { values: Partial<LeadFormValues>; contactNumbers: ContactNumber[]; bitrixId?: string };

function hasDraftContent(d: LeadDraft | null): boolean {
  if (!d) return false;
  const anyValue = Object.values(d.values ?? {}).some(
    (x) => typeof x === "string" && x.trim() !== "",
  );
  return anyValue || (d.contactNumbers?.length ?? 0) > 0;
}

function readLeadDraft(): LeadDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LEAD_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as LeadDraft) : null;
  } catch {
    return null;
  }
}

function persistLeadDraft(values: LeadFormValues, contactNumbers: ContactNumber[], bitrixId: string) {
  if (typeof window === "undefined") return;
  const draft: LeadDraft = { values, contactNumbers, bitrixId };
  if (hasDraftContent(draft)) {
    localStorage.setItem(LEAD_DRAFT_KEY, JSON.stringify(draft));
  } else {
    localStorage.removeItem(LEAD_DRAFT_KEY);
  }
}

function clearLeadDraft() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LEAD_DRAFT_KEY);
}

export function LeadDrawer({ open, onOpenChange, editLead, onSuccess }: LeadDrawerProps) {
  const isEdit = !!editLead;
  const qc = useQueryClient();

  const { mutateAsync: createLead, isPending: isCreating } = useCreateLead();
  const { mutateAsync: updateLead, isPending: isUpdating } = useUpdateLead();
  const isPending = isCreating || isUpdating;

  const { data: venues = [] } = useVenues();
  const { data: eventTypes = [] } = useEventTypes();
  const { data: statuses = [] } = useLeadStatuses();
  const { users: salesUsers } = useSalesUsers();
  const { user } = useCurrentUser();

  // Sales auto-detect: salesUsers already contains both "sales" & "sales-mice"
  // roles, and s.id === profileId. If the logged-in user is in that list, lock
  // the assignee field (create → self; edit → record's sales, shown as-is).
  // Admin/manager picks freely.
  const currentUserIsSales = !!user && salesUsers.some((s) => s.id === user.profileId);

  const [sourceOptions, setSourceOptions] = useState<Option[]>([]);
  useEffect(() => {
    fetchJson<Option[]>("/api/source-of-informations").then(setSourceOptions);
  }, []);

  const [bitrixId, setBitrixId] = useState("");

  // When the drawer opens with an existing lead (edit mode), form.reset() sets
  // venueId which triggers the availability effect — that effect would immediately
  // clear weddingSession before the user has a chance to see it.  This flag is
  // set to true during the reset call and cleared after one tick so the
  // availability effect can distinguish "initial load" from "user changed venue".
  const isResettingRef = useRef(false);

  const form = useForm<LeadFormValues>({
    defaultValues: DEFAULT_VALUES,
  });

  const [contactNumbers, setContactNumbers] = useState<ContactNumber[]>([]);
  const [contactInput, setContactInput] = useState({ name: "", phone: "" });
  const [contactPopoverOpen, setContactPopoverOpen] = useState(false);

  const watchedVenueId = form.watch("venueId");
  const watchedCategory = form.watch("category");
  const watchedSourceId = form.watch("sourceOfInformationId");
  const watchedAssignedToId = form.watch("assignedToId");
  // Name shown in the locked sales field — resolves from the current field value
  // so edit mode displays the record's actual sales (not the logged-in user).
  const lockedSalesName =
    salesUsers.find((s) => s.id === watchedAssignedToId)?.fullName ??
    (currentUserIsSales ? (user?.name ?? "—") : "—");
  const isBitrixSource = sourceOptions.find((o) => o.id === watchedSourceId)?.name.toLowerCase().includes("bitrix") ?? false;
  const isWeddings = watchedCategory === "WEDDINGS";

  // Watch all required fields so the submit button reacts to completeness.
  const watchedName = form.watch("name");
  const watchedStatusId = form.watch("statusId");
  const watchedEventTypeId = form.watch("eventTypeId");
  const watchedEventDate = form.watch("eventDate");
  const watchedWeddingSession = form.watch("weddingSession");
  const watchedTime = form.watch("time");

  // Create-mode only: disable submit until every required field is filled.
  const isFormIncomplete =
    !watchedName?.trim() ||
    contactNumbers.length === 0 ||
    !watchedStatusId ||
    !watchedCategory ||
    !watchedEventTypeId ||
    !watchedAssignedToId ||
    !watchedSourceId ||
    !watchedEventDate ||
    !watchedTime?.trim() ||
    !watchedWeddingSession ||
    (isBitrixSource && !bitrixId.trim());

  // ── Venue availability ───────────────────────────────────────────────────────
  type DayAvail = { morning: boolean; evening: boolean; fullday: boolean };
  const [availability, setAvailability] = useState<Record<string, DayAvail>>({});
  const [availLoading, setAvailLoading] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date());

  useEffect(() => {
    if (!watchedVenueId) {
      setAvailability({});
      return;
    }
    // Only clear the session when the user explicitly changes the venue, not
    // when the form is being reset during drawer open (isResettingRef guards this).
    if (!isResettingRef.current) {
      form.setValue("weddingSession", "");
    }
    setAvailLoading(true);
    const month = format(startOfMonth(visibleMonth), "yyyy-MM");
    const params = new URLSearchParams({ month });
    fetch(`/api/venues/${watchedVenueId}/availability?${params}`)
      .then((r) => r.json())
      .then((data: Record<string, DayAvail>) => setAvailability(data))
      .catch(() => setAvailability({}))
      .finally(() => setAvailLoading(false));
  }, [watchedVenueId, visibleMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  function getDateStatus(d: Date): "available" | "partial" | "unavailable" | null {
    const key = format(d, "yyyy-MM-dd");
    const a = availability[key];
    if (!a) return null;
    const count = [a.morning, a.evening, a.fullday].filter(Boolean).length;
    if (count === 0) return "unavailable";
    if (count === 3) return "available";
    return "partial";
  }

  function getAvailableSessions(dateStr: string): string[] {
    const a = availability[dateStr];
    if (!a) return ["morning", "evening", "fullday"];
    const sessions: string[] = [];
    if (a.morning) sessions.push("morning");
    if (a.evening) sessions.push("evening");
    if (a.fullday && a.morning && a.evening) sessions.push("fullday");
    return sessions;
  }

  useEffect(() => {
    if (!open) return;

    if (editLead) {
      isResettingRef.current = true;
      form.reset({
        name: editLead.name,
        instansi: editLead.instansi ?? "",
        email: editLead.email ?? "",
        address: editLead.address ?? "",
        category: editLead.category ?? "WEDDINGS",
        statusId: editLead.status.id,
        venueId: editLead.venue?.id ?? "",
        eventTypeId: editLead.eventType?.id ?? "",
        sourceOfInformationId: editLead.sourceOfInformation?.id ?? "",
        assignedToId: editLead.assignedTo?.id ?? "",
        eventDate: editLead.eventDate
          ? new Date(editLead.eventDate).toISOString().split("T")[0]
          : "",
        weddingSession: (editLead.weddingSession as "morning" | "evening" | "fullday" | "") ?? "",
        time: editLead.time ?? "",
        estimatedPax: editLead.estimatedPax ? String(editLead.estimatedPax) : "",
        budgetRange: editLead.budgetRange ?? "",
        notes: editLead.notes ?? "",
      });
      // Defer clearing the flag so the availability effect that fires synchronously
      // after venueId changes during reset can observe it before we clear.
      setTimeout(() => {
        isResettingRef.current = false;
      }, 0);
      setContactNumbers(editLead.contactNumbers);
      setBitrixId(editLead.bitrixId ?? "");
    } else {
      const draft = readLeadDraft();
      if (hasDraftContent(draft)) {
        form.reset({ ...DEFAULT_VALUES, ...draft!.values });
        setContactNumbers(draft!.contactNumbers ?? []);
        setBitrixId(draft!.bitrixId ?? "");
      } else {
        form.reset(DEFAULT_VALUES);
        setContactNumbers([]);
        setBitrixId("");
      }
    }
    setContactInput({ name: "", phone: "" });
    setContactPopoverOpen(false);
  }, [open, editLead]); // eslint-disable-line react-hooks/exhaustive-deps

  // Create mode: force-assign to the logged-in sales user (also covers the case
  // where salesUsers loads after the reset effect above has already run).
  useEffect(() => {
    if (open && !isEdit && currentUserIsSales && user?.profileId) {
      form.setValue("assignedToId", user.profileId);
    }
  }, [open, isEdit, currentUserIsSales, user?.profileId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill time from session + event type code (weddings only).
  // Mirrors the same logic in booking-drawer and quotation-drawer.
  useEffect(() => {
    if (!isWeddings) return;
    const et = eventTypes.find((e) => e.id === watchedEventTypeId);
    if (!et) return;
    const weddingEventType = mapCodeToWeddingEventType(et.code);
    const autoTime = getWeddingTimeRange(watchedWeddingSession as WeddingSession | "", weddingEventType);
    if (autoTime) {
      form.setValue("time", autoTime);
    }
  }, [watchedEventTypeId, watchedWeddingSession, isWeddings]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist draft on form field changes (create mode only)
  useEffect(() => {
    if (!open || isEdit) return;
    const sub = form.watch((values) => {
      persistLeadDraft(values as LeadFormValues, contactNumbers, bitrixId);
    });
    return () => sub.unsubscribe();
  }, [open, isEdit, contactNumbers, bitrixId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist draft on contact-number or bitrixId changes (create mode only)
  useEffect(() => {
    if (!open || isEdit) return;
    persistLeadDraft(form.getValues(), contactNumbers, bitrixId);
  }, [contactNumbers, bitrixId, open, isEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  function addContact() {
    const stored = contactInput.phone.trim();
    const label = contactInput.name.trim();
    // Label is mandatory
    if (!label) {
      toast.error("Label wajib diisi (contoh: cpw, cpp, ortu)");
      return;
    }
    // stored is dialCode+national; national part must be ≥ 7 digits
    const { nationalNumber } = parseStoredPhone(stored);
    if (nationalNumber.length < 7) {
      toast.error("Nomor terlalu pendek");
      return;
    }
    if (contactNumbers.some((c) => c.number === stored)) {
      toast.error("Nomor sudah ada");
      return;
    }
    setContactNumbers((prev) => [
      ...prev,
      { label, number: stored },
    ]);
    setContactInput({ name: "", phone: "" });
    setContactPopoverOpen(false);
  }

  function removeContact(idx: number) {
    setContactNumbers((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSubmit(values: LeadFormValues) {
    if (contactNumbers.length === 0) {
      toast.error("Minimal 1 nomor HP/WA wajib diisi.");
      return;
    }
    if (isBitrixSource && !bitrixId.trim()) {
      toast.error("Bitrix ID wajib diisi jika sumber informasi adalah Bitrix.");
      return;
    }

    const payload: CreateLeadInput = {
      name: values.name,
      instansi: values.instansi || undefined,
      contactNumbers,
      email: values.email || undefined,
      address: values.address || undefined,
      eventDate: values.eventDate,
      time: values.time || undefined,
      weddingSession: (values.weddingSession as "morning" | "evening" | "fullday") || undefined,
      estimatedPax: values.estimatedPax ? Number(values.estimatedPax) : null,
      budgetRange: values.budgetRange || undefined,
      notes: values.notes || undefined,
      category: values.category,
      venueId: values.venueId || undefined,
      eventTypeId: values.eventTypeId,
      sourceOfInformationId: values.sourceOfInformationId,
      assignedToId: values.assignedToId,
      statusId: values.statusId,
      bitrixId: isBitrixSource ? bitrixId || null : null,
    };

    // Edit mode uses the partial schema so untouched optional fields don't
    // block the update; weddings still require a session via superRefine.
    const schema = isEdit ? updateLeadSchema : createLeadSchema;
    const editPayload = isEdit ? { ...payload, id: editLead!.id } : payload;
    const validated = schema.safeParse(editPayload);
    if (!validated.success) {
      toast.error(validated.error.issues[0].message);
      return;
    }

    if (isEdit && editLead) {
      const result = await updateLead(validated.data as Parameters<typeof updateLead>[0]);
      if (!result.success) {
        toast.error(result.error ?? "Gagal menyimpan lead.");
        return;
      }
      toast.success("Lead berhasil diperbarui.");
    } else {
      const result = await createLead(validated.data as CreateLeadInput);
      if (!result.success) {
        toast.error(result.error ?? "Gagal menyimpan lead.");
        return;
      }
      clearLeadDraft();
      toast.success("Lead berhasil disimpan.");
      onSuccess?.();
    }

    onOpenChange(false);
  }

  return (
    <Drawer
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title={isEdit ? "Edit Lead" : "Tambah Lead"}
      maxWidth="sm:max-w-lg"
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto">
          <Form {...form}>
            <form className="space-y-4 pb-2">
              {/* Nama Client */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Client *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Budi Santoso" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Instansi */}
              <FormField
                control={form.control}
                name="instansi"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instansi</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. PT Maju Bersama (opsional)" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Contact Person (multi) */}
              <div>
                <FormLabel className="text-sm font-medium">No. HP/WA *</FormLabel>
                <div className="mt-1 rounded-lg bg-muted p-3 space-y-2">
                  {contactNumbers.map((entry, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded-md bg-background border px-3 py-2"
                    >
                      <div className="flex-1 min-w-0">
                        {entry.label && (
                          <p className="text-xs text-muted-foreground">{entry.label}</p>
                        )}
                        <p className="text-sm font-medium">+{entry.number}</p>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 text-destructive hover:bg-destructive/10 rounded-full p-1"
                        onClick={() => removeContact(idx)}
                      >
                        <CloseCircle weight="BoldDuotone" className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <Popover
                    open={contactPopoverOpen}
                    onOpenChange={(o) => {
                      setContactPopoverOpen(o);
                      if (!o) setContactInput({ name: "", phone: "" });
                    }}
                  >
                    <PopoverTrigger render={
                      <Button type="button" variant="outline" className="w-full text-xs h-8">
                        Tambah Nomor
                      </Button>
                    } />
                    <PopoverContent className="w-72 p-3" align="end">
                      <p className="text-xs font-medium mb-2">Tambah Nomor</p>
                      <ContactEntry
                        nameValue={contactInput.name}
                        onNameChange={(v) => setContactInput((p) => ({ ...p, name: v }))}
                        phoneValue={contactInput.phone}
                        onPhoneChange={(v) => setContactInput((p) => ({ ...p, phone: v }))}
                        onAdd={addContact}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="nama@email.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Alamat */}
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alamat</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={2}
                        placeholder="Alamat lengkap (opsional)..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Tipe Booking */}
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipe Booking *</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={[
                          { id: "WEDDINGS", name: "Wedding" },
                          { id: "MICE", name: "MICE" },
                        ]}
                        value={field.value}
                        onChange={(v) => {
                          field.onChange(v);
                          form.setValue("eventTypeId", "");
                          // MICE defaults to a full-day session (still editable).
                          if (v === "MICE") form.setValue("weddingSession", "fullday");
                        }}
                        placeholder="Pilih tipe booking..."
                        searchPlaceholder="Cari tipe booking..."
                        emptyText="Tidak ada opsi"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Assigned To */}
              {currentUserIsSales ? (
                /* Logged-in user is a sales → locked to themselves */
                <div className="w-full">
                  <FormLabel>Assigned To (Sales) *</FormLabel>
                  <div className="mt-1 flex h-9 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-foreground cursor-not-allowed select-none">
                    {lockedSalesName}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Lead ini akan tercatat atas nama Anda.
                  </p>
                </div>
              ) : (
                <FormField
                  control={form.control}
                  name="assignedToId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned To (Sales) *</FormLabel>
                      <SearchableSelect
                        options={salesUsers.map((u) => ({
                          id: u.id,
                          name: u.fullName ?? "",
                          badge: u.role?.name === "sales-mice" ? "Sales-Mice" : "Sales",
                        }))}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Pilih sales..."
                        searchPlaceholder="Cari sales..."
                        emptyText="Sales tidak ditemukan"
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Status */}
              <FormField
                control={form.control}
                name="statusId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={statuses.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger className={cn("w-full", statuses.length === 0 && "opacity-60")}>
                          <SelectValue placeholder="Pilih status..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {statuses.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            <span className="flex items-center gap-2">
                              <span
                                className="inline-block w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: s.color }}
                              />
                              {s.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Venue */}
              <FormField
                control={form.control}
                name="venueId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Venue</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={venues.map((v) => ({ id: v.id, name: v.name }))}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Pilih venue..."
                        searchPlaceholder="Cari venue..."
                        emptyText="Venue tidak ditemukan"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Event Type */}
              <FormField
                control={form.control}
                name="eventTypeId"
                render={({ field }) => {
                  const filteredEventTypes = eventTypes.filter(
                    (et) => et.category === watchedCategory,
                  );
                  return (
                    <FormItem>
                      <FormLabel>Event Type *</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          options={filteredEventTypes.map((et) => ({ id: et.id, name: et.name }))}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Pilih event type..."
                          searchPlaceholder="Cari event type..."
                          emptyText="Tidak ada event type"
                          disabled={filteredEventTypes.length === 0}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              {/* Tanggal Event */}
              <FormField
                control={form.control}
                name="eventDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tanggal Event *</FormLabel>
                    <Popover>
                      <PopoverTrigger render={
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !field.value && "text-muted-foreground",
                          )}
                        >
                          <CalendarSolarIcon weight="BoldDuotone" className="mr-2 h-4 w-4" />
                          {field.value
                            ? format(new Date(field.value + "T00:00:00"), "PPP")
                            : "Pilih tanggal event"}
                        </Button>
                      } />
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          captionLayout="dropdown"
                          selected={field.value ? new Date(field.value + "T00:00:00") : undefined}
                          onSelect={(date) => {
                            if (date) {
                              const y = date.getFullYear();
                              const m = String(date.getMonth() + 1).padStart(2, "0");
                              const d = String(date.getDate()).padStart(2, "0");
                              field.onChange(`${y}-${m}-${d}`);
                              form.setValue("weddingSession", "");
                            } else {
                              field.onChange("");
                              form.setValue("weddingSession", "");
                            }
                          }}
                          disabled={(d) => getDateStatus(d) === "unavailable"}
                          fromYear={new Date().getFullYear() - 10}
                          toYear={new Date().getFullYear() + 5}
                          defaultMonth={
                            field.value ? new Date(field.value + "T00:00:00") : new Date()
                          }
                          onMonthChange={setVisibleMonth}
                          modifiers={{
                            available: (d) => !!watchedVenueId && getDateStatus(d) === "available",
                            partial: (d) => !!watchedVenueId && getDateStatus(d) === "partial",
                            unavailable: (d) =>
                              !!watchedVenueId && getDateStatus(d) === "unavailable",
                          }}
                          modifiersClassNames={{
                            available: "day-available",
                            partial: "day-partial",
                            unavailable: "day-unavailable",
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                    {availLoading && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Mengecek ketersediaan...
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Session — shown for both; MICE defaults to fullday (editable) */}
              <FormField
                control={form.control}
                name="weddingSession"
                render={({ field }) => {
                  const dateStr = watchedEventDate || null;
                  const sessions = dateStr ? getAvailableSessions(dateStr) : ["morning", "evening", "fullday"];
                  return (
                    <FormItem>
                      <FormLabel>Session *</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          options={sessions.map((s) => ({ id: s, name: SESSION_LABELS[s] }))}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder={!watchedEventDate ? "Pilih tanggal dulu" : "Pilih session..."}
                          searchPlaceholder="Cari session..."
                          emptyText="Tidak ada session tersedia"
                          disabled={!watchedEventDate}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              {/* Time */}
              <FormField
                control={form.control}
                name="time"
                render={({ field }) => {
                  const et = eventTypes.find((e) => e.id === watchedEventTypeId);
                  const hasAutoTime =
                    isWeddings &&
                    !!watchedWeddingSession &&
                    !!et &&
                    !!mapCodeToWeddingEventType(et.code);
                  return (
                    <FormItem className="flex w-full flex-col">
                      <FormLabel>
                        Time *
                        {hasAutoTime && (
                          <span className="ml-2 font-normal text-muted-foreground text-xs">
                            (auto-filled, bisa diubah manual)
                          </span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <TimeRangePicker
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Pilih waktu (bisa rentang)..."
                        />
                      </FormControl>
                    </FormItem>
                  );
                }}
              />

              {/* Estimasi Pax */}
              <FormField
                control={form.control}
                name="estimatedPax"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimasi Pax</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min={1} placeholder="300" inputMode="numeric" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Budget Range */}
              <FormField
                control={form.control}
                name="budgetRange"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget Range</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. 50 - 75 juta (opsional)" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Sumber Informasi */}
              <FormField
                control={form.control}
                name="sourceOfInformationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sumber Informasi *</FormLabel>
                    <SearchableSelect
                      options={sourceOptions}
                      value={field.value}
                      onChange={(id) => {
                        field.onChange(id);
                        const isBitrix = sourceOptions.find((o) => o.id === id)?.name.toLowerCase().includes("bitrix") ?? false;
                        if (!isBitrix) setBitrixId("");
                      }}
                      placeholder="Pilih sumber informasi..."
                      searchPlaceholder="Cari sumber..."
                      emptyText="Tidak ada data"
                      onAdd={async (name) => {
                        const { createSourceOfInformation } = await import(
                          "@/actions/source-of-information"
                        );
                        const result = await createSourceOfInformation(name);
                        if (!result.success) {
                          toast.error(result.error ?? "Gagal menambahkan");
                          return;
                        }
                        await qc.invalidateQueries({ queryKey: ["source-of-informations"] });
                        field.onChange(result.item!.id);
                        toast.success(`"${name}" berhasil ditambahkan`);
                      }}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Bitrix ID — hanya muncul jika sumber informasi adalah Bitrix */}
              {isBitrixSource && (
                <div>
                  <FormLabel className="text-sm font-medium">Bitrix ID *</FormLabel>
                  <Input
                    placeholder="e.g. 12345"
                    value={bitrixId}
                    onChange={(e) => setBitrixId(e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}

              {/* Catatan */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catatan</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} placeholder="Catatan tambahan (opsional)..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>

        <div className="sticky bottom-0 bg-background pt-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 cursor-pointer"
              disabled={isPending}
            >
              Batal
            </Button>
            <Button
              onClick={form.handleSubmit(onSubmit)}
              className="flex-1 cursor-pointer"
              disabled={isPending || (!isEdit && isFormIncomplete)}
            >
              {isPending ? "Menyimpan..." : isEdit ? "Simpan" : "Tambah"}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
