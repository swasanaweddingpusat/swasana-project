"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CloseCircle } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { createLeadSchema } from "@/lib/validations/lead";
import type { CreateLeadInput } from "@/lib/validations/lead";
import type { LeadListItem, ContactNumber } from "@/types/lead";
import { useCreateLead, useUpdateLead } from "@/hooks/use-leads";
import { useVenues } from "@/hooks/use-venues";
import { useLeadStatuses } from "@/hooks/use-lead-statuses";
import { useEventTypes } from "@/hooks/use-event-types";
import { useUsers } from "@/hooks/use-users";

interface LeadDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editLead: LeadListItem | null;
}

interface LeadFormValues {
  name: string;
  email: string;
  statusId: string;
  venueId: string;
  packageId: string;
  eventTypeId: string;
  sourceOfInformationId: string;
  assignedToId: string;
  eventDate: string;
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

const DEFAULT_VALUES: LeadFormValues = {
  name: "",
  email: "",
  statusId: "",
  venueId: "",
  packageId: "",
  eventTypeId: "",
  sourceOfInformationId: "",
  assignedToId: "",
  eventDate: "",
  estimatedPax: "",
  budgetRange: "",
  notes: "",
};

export function LeadDrawer({ open, onOpenChange, editLead }: LeadDrawerProps) {
  const isEdit = !!editLead;
  const qc = useQueryClient();

  const { mutateAsync: createLead, isPending: isCreating } = useCreateLead();
  const { mutateAsync: updateLead, isPending: isUpdating } = useUpdateLead();
  const isPending = isCreating || isUpdating;

  const { data: venues = [] } = useVenues();
  const { data: eventTypes = [] } = useEventTypes();
  const { data: statuses = [] } = useLeadStatuses();
  const { data: usersData } = useUsers(undefined, { page: 1, limit: 100 });
  const assignableUsers = (usersData?.users ?? []).map((u) => ({
    id: u.profile?.id ?? u.id,
    fullName: u.profile?.fullName ?? u.name ?? u.email,
  }));

  const [sourceOptions, setSourceOptions] = useState<Option[]>([]);
  useEffect(() => {
    fetchJson<Option[]>("/api/source-of-informations").then(setSourceOptions);
  }, []);

  const form = useForm<LeadFormValues>({
    defaultValues: DEFAULT_VALUES,
  });

  const [contactNumbers, setContactNumbers] = useState<ContactNumber[]>([]);
  const [contactInput, setContactInput] = useState({ name: "", number: "" });
  const [contactPopoverOpen, setContactPopoverOpen] = useState(false);

  const watchedVenueId = form.watch("venueId");

  const [packages, setPackages] = useState<Option[]>([]);
  useEffect(() => {
    if (!watchedVenueId) {
      setPackages([]);
      return;
    }
    fetchJson<{ data: Array<{ id: string; packageName: string }> }>(
      `/api/packages?venueId=${watchedVenueId}&page=1&limit=100`
    ).then((res) => {
      setPackages(res.data?.map((p) => ({ id: p.id, name: p.packageName })) ?? []);
    });
  }, [watchedVenueId]);

  useEffect(() => {
    if (!open) return;

    if (editLead) {
      form.reset({
        name: editLead.name,
        email: editLead.email ?? "",
        statusId: editLead.status.id,
        venueId: editLead.venue?.id ?? "",
        packageId: editLead.package?.id ?? "",
        eventTypeId: editLead.eventType?.id ?? "",
        sourceOfInformationId: editLead.sourceOfInformation?.id ?? "",
        assignedToId: editLead.assignedTo?.id ?? "",
        eventDate: editLead.eventDate
          ? new Date(editLead.eventDate).toISOString().split("T")[0]
          : "",
        estimatedPax: editLead.estimatedPax ? String(editLead.estimatedPax) : "",
        budgetRange: editLead.budgetRange ?? "",
        notes: editLead.notes ?? "",
      });
      setContactNumbers(editLead.contactNumbers);
    } else {
      form.reset(DEFAULT_VALUES);
      setContactNumbers([]);
    }
    setContactInput({ name: "", number: "" });
    setContactPopoverOpen(false);
  }, [open, editLead]); // eslint-disable-line react-hooks/exhaustive-deps

  function addContact() {
    const digits = contactInput.number.trim();
    if (digits.length < 7) return;
    const full = "62" + digits;
    if (contactNumbers.some((c) => c.number === full)) {
      toast.error("Nomor sudah ada");
      return;
    }
    setContactNumbers((prev) => [
      ...prev,
      { label: contactInput.name.trim(), number: full },
    ]);
    setContactInput({ name: "", number: "" });
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

    const payload: CreateLeadInput = {
      name: values.name,
      contactNumbers,
      email: values.email || undefined,
      eventDate: values.eventDate || undefined,
      estimatedPax: values.estimatedPax ? Number(values.estimatedPax) : null,
      budgetRange: values.budgetRange || undefined,
      notes: values.notes || undefined,
      venueId: values.venueId || null,
      packageId: values.packageId || null,
      eventTypeId: values.eventTypeId || null,
      sourceOfInformationId: values.sourceOfInformationId || null,
      assignedToId: values.assignedToId || null,
      statusId: values.statusId,
    };

    const validated = createLeadSchema.safeParse(payload);
    if (!validated.success) {
      toast.error(validated.error.issues[0].message);
      return;
    }

    if (isEdit && editLead) {
      const result = await updateLead({ ...validated.data, id: editLead.id });
      if (!result.success) {
        toast.error(result.error ?? "Gagal menyimpan lead.");
        return;
      }
      toast.success("Lead berhasil diperbarui.");
    } else {
      const result = await createLead(validated.data);
      if (!result.success) {
        toast.error(result.error ?? "Gagal menyimpan lead.");
        return;
      }
      toast.success("Lead berhasil disimpan.");
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
              {/* Nama */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Lengkap *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Budi & Sari" />
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
                      if (!o) setContactInput({ name: "", number: "" });
                    }}
                  >
                    <PopoverTrigger render={
                      <Button type="button" variant="outline" className="w-full text-xs h-8">
                        Tambah Nomor
                      </Button>
                    } />
                    <PopoverContent className="w-72 p-3 space-y-2" align="end">
                      <p className="text-xs font-medium">Tambah Nomor</p>
                      <Input
                        value={contactInput.name}
                        onChange={(e) => setContactInput((p) => ({ ...p, name: e.target.value }))}
                        placeholder="cpw, cpp, ortu, ..."
                        className="h-8 text-xs"
                      />
                      <div className="flex items-center rounded-md border border-input bg-background overflow-hidden">
                        <span className="px-2 text-xs text-muted-foreground border-r bg-muted self-stretch flex items-center shrink-0">
                          +62
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={contactInput.number}
                          onChange={(e) => {
                            let raw = e.target.value.replace(/\D/g, "");
                            if (raw.startsWith("62")) raw = raw.slice(2);
                            else if (raw.startsWith("0")) raw = raw.slice(1);
                            setContactInput((p) => ({ ...p, number: raw.slice(0, 13) }));
                          }}
                          placeholder="81234567890"
                          className="flex-1 px-3 py-1.5 text-xs outline-none bg-transparent min-w-0"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addContact();
                            }
                          }}
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="w-full h-8 text-xs"
                        onClick={addContact}
                      >
                        Tambah
                      </Button>
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

              {/* Assigned To */}
              <FormField
                control={form.control}
                name="assignedToId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned To (Sales)</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Pilih sales (opsional)..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {assignableUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.fullName}
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
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        form.setValue("packageId", "");
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Pilih venue (opsional)..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {venues.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Paket */}
              {watchedVenueId && (
                <FormField
                  control={form.control}
                  name="packageId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Paket</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={packages.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Pilih paket (opsional)..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {packages.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Event Type */}
              <FormField
                control={form.control}
                name="eventTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Pilih event type (opsional)..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {eventTypes.map((et) => (
                          <SelectItem key={et.id} value={et.id}>
                            <span className="flex items-center gap-2">
                              {et.name}
                              <span className="text-[10px] text-muted-foreground">
                                {et.category === "MICE" ? "(MICE)" : "(Wedding)"}
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <FormLabel>Sumber Informasi</FormLabel>
                    <SearchableSelect
                      options={sourceOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Pilih sumber informasi"
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

              {/* Tanggal Event */}
              <FormField
                control={form.control}
                name="eventDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tanggal Event</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
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
              disabled={isPending}
            >
              {isPending ? "Menyimpan..." : isEdit ? "Simpan" : "Tambah"}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
