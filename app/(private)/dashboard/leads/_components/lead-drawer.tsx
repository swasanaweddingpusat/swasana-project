"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeadItem } from "./leads-table";

interface LeadDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editLead: LeadItem | null;
}

interface ContactEntry {
  name: string;
  number: string;
}

interface LeadFormValues {
  name: string;
  email: string;
  source: string;
  venue: string;
  category: "weddings" | "mice" | "";
  eventType: string;
  eventDate: string;
  estimatedPax: string;
  packageName: string;
  budgetRange: string;
  notes: string;
}

const VENUES = [
  "Bringhall",
  "Grand Puri 2",
  "Sasana Esthi Sopo",
  "De Rivier Mansion",
  "Lippo Grand Ballroom",
  "Bripensiunan",
  "Samisara",
  "Tamrin",
];

const PACKAGES = ["Gold", "Platinum", "Sapphire"];

const EVENT_TYPES: Record<"weddings" | "mice", string[]> = {
  weddings: ["Resepsi", "Akad & Resepsi", "Tea Pai & Resepsi"],
  mice: ["Halfday 6hrs", "Fullday Meeting 8hrs", "Fullday Meeting 12hrs"],
};

const DEFAULT_VALUES: LeadFormValues = {
  name: "",
  email: "",
  source: "",
  venue: "",
  category: "",
  eventType: "",
  eventDate: "",
  estimatedPax: "",
  packageName: "",
  budgetRange: "",
  notes: "",
};

type Option = { id: string; name: string };

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) return [] as unknown as T;
  return res.json();
}

export function LeadDrawer({ open, onOpenChange, editLead }: LeadDrawerProps) {
  const isEdit = !!editLead;
  const qc = useQueryClient();

  const { data: sourceOptions = [] } = useQuery({
    queryKey: ["source-of-informations"],
    queryFn: () => fetchJson<Option[]>("/api/source-of-informations"),
    staleTime: 5 * 60_000,
  });

  const form = useForm<LeadFormValues>({
    defaultValues: DEFAULT_VALUES,
  });

  const [contactNumbers, setContactNumbers] = useState<ContactEntry[]>([]);
  const [contactInput, setContactInput] = useState({ name: "", number: "" });
  const [contactPopoverOpen, setContactPopoverOpen] = useState(false);

  const watchedCategory = form.watch("category");

  useEffect(() => {
    if (!open) return;
    if (editLead) {
      form.reset({
        name: editLead.name,
        email: editLead.email,
        source: editLead.source,
        venue: editLead.venue,
        category: editLead.category,
        eventType: editLead.eventType,
        eventDate: editLead.eventDate,
        estimatedPax: String(editLead.estimatedPax),
        packageName: editLead.packageName ?? "",
        budgetRange: "",
        notes: "",
      });
      setContactNumbers([{ name: "", number: editLead.phone }]);
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
    setContactNumbers((prev) => [...prev, { name: contactInput.name.trim(), number: full }]);
    setContactInput({ name: "", number: "" });
    setContactPopoverOpen(false);
  }

  function onSubmit(_values: LeadFormValues) {
    if (contactNumbers.length === 0) {
      toast.error("Minimal 1 nomor HP/WA wajib diisi.");
      return;
    }
    toast.success(isEdit ? "Lead berhasil diperbarui." : "Lead berhasil disimpan.");
    onOpenChange(false);
  }

  const availableEventTypes =
    watchedCategory === "weddings" || watchedCategory === "mice"
      ? EVENT_TYPES[watchedCategory]
      : [];

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
                rules={{ required: "Nama wajib diisi" }}
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
                <FormLabel className={cn("text-sm", "font-medium")}>No. HP/WA *</FormLabel>
                <div className={cn("mt-1", "rounded-lg", "bg-muted", "p-3", "space-y-2")}>
                  {contactNumbers.map((entry, idx) => (
                    <div key={idx} className={cn("flex", "items-center", "gap-2", "rounded-md", "bg-white", "border", "px-3", "py-2")}>
                      <div className={cn("flex-1", "min-w-0")}>
                        {entry.name && <p className={cn("text-xs", "text-muted-foreground")}>{entry.name}</p>}
                        <p className={cn("text-sm", "font-medium")}>+{entry.number}</p>
                      </div>
                      <button
                        type="button"
                        className={cn("shrink-0", "text-destructive", "hover:bg-destructive/10", "rounded-full", "p-1")}
                        onClick={() => setContactNumbers((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <X className={cn("w-3.5", "h-3.5")} />
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
                      <Button type="button" variant="outline" className="w-full text-xs h-8 bg-white">
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
                        <span className="px-2 text-xs text-muted-foreground border-r bg-muted self-stretch flex items-center shrink-0">+62</span>
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
                      <Button type="button" size="sm" className="w-full h-8 text-xs" onClick={addContact}>
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
                      <Input
                        {...field}
                        type="email"
                        placeholder="nama@email.com"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Sumber Info */}
              <FormField
                control={form.control}
                name="source"
                rules={{ required: "Sumber info wajib dipilih" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sumber Informasi *</FormLabel>
                    <SearchableSelect
                      options={sourceOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Pilih sumber informasi"
                      searchPlaceholder="Cari sumber..."
                      emptyText="Tidak ada data"
                      onAdd={async (name) => {
                        const { createSourceOfInformation } = await import("@/actions/source-of-information");
                        const result = await createSourceOfInformation(name);
                        if (!result.success) { toast.error(result.error ?? "Gagal menambahkan"); return; }
                        await qc.invalidateQueries({ queryKey: ["source-of-informations"] });
                        field.onChange(result.item!.id);
                        toast.success(`"${name}" berhasil ditambahkan`);
                      }}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Venue */}
              <FormField
                control={form.control}
                name="venue"
                rules={{ required: "Venue wajib dipilih" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Venue *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih venue..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {VENUES.map((v) => (
                          <SelectItem key={v} value={v}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Kategori */}
              <FormField
                control={form.control}
                name="category"
                rules={{ required: "Kategori wajib dipilih" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kategori *</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        form.setValue("eventType", "");
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih kategori..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="weddings">Weddings</SelectItem>
                        <SelectItem value="mice">MICE</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Event Type — depends on category */}
              <FormField
                control={form.control}
                name="eventType"
                rules={{ required: "Event type wajib dipilih" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Type *</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!watchedCategory}
                    >
                      <FormControl>
                        <SelectTrigger
                          className={cn(!watchedCategory && "opacity-60")}
                        >
                          <SelectValue
                            placeholder={
                              watchedCategory
                                ? "Pilih event type..."
                                : "Pilih kategori dulu"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableEventTypes.map((et) => (
                          <SelectItem key={et} value={et}>
                            {et}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Tanggal Event */}
              <FormField
                control={form.control}
                name="eventDate"
                rules={{ required: "Tanggal event wajib diisi" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tanggal Event *</FormLabel>
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
                rules={{ required: "Estimasi pax wajib diisi" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimasi Pax *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min={1}
                        placeholder="300"
                        inputMode="numeric"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Paket (optional) */}
              <FormField
                control={form.control}
                name="packageName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Paket</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih paket (opsional)..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PACKAGES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Budget Range (optional) */}
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

              {/* Catatan (optional) */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catatan</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        placeholder="Catatan tambahan (opsional)..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 bg-white pt-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 cursor-pointer"
            >
              Batal
            </Button>
            <Button
              onClick={form.handleSubmit(onSubmit)}
              className="flex-1 bg-black text-white hover:bg-gray-800 cursor-pointer"
            >
              {isEdit ? "Simpan" : "Tambah"}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
