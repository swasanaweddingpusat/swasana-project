"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Drawer } from "@/components/shared/drawer";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { customerSchema, type CustomerInput } from "@/lib/validations/customer";
import { useCreateCustomer, useUpdateCustomer } from "@/hooks/use-customers";
import { createSourceOfInformation } from "@/actions/source-of-information";
import { createMemberStatus } from "@/actions/member-status";
import type { CustomerItem } from "@/lib/queries/customers";

interface CustomerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editCustomer?: CustomerItem | null;
}

type OptionItem = { id: string; name: string };

const DRAFT_KEY = "customer_drawer_draft";
interface CustomerDraft { name: string; mobileNumbers: string[]; email: string; nikNumber: string; ktpAddress: string; type: string; club: string; memberStatus: string; notes: string; }
function saveDraft(d: CustomerDraft) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* noop */ } }
function loadDraft(): CustomerDraft | null { try { const r = localStorage.getItem(DRAFT_KEY); return r ? JSON.parse(r) : null; } catch { return null; } }
function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch { /* noop */ } }

async function fetchOptions(url: string): Promise<OptionItem[]> {
  const res = await fetch(url);
  if (!res.ok) return [];
  return res.json();
}

export function CustomerDrawer({ open, onOpenChange, editCustomer }: CustomerDrawerProps) {
  const isEdit = !!editCustomer;
  const createMut = useCreateCustomer();
  const updateMut = useUpdateCustomer();
  const qc = useQueryClient();

  const { data: sourceOptions = [] } = useQuery({
    queryKey: ["source-of-informations"],
    queryFn: () => fetchOptions("/api/source-of-informations"),
    staleTime: 5 * 60 * 1000,
  });

  const { data: memberStatusOptions = [] } = useQuery({
    queryKey: ["member-statuses"],
    queryFn: () => fetchOptions("/api/member-statuses"),
    staleTime: 5 * 60 * 1000,
  });

  // Store selected names (SearchableSelect uses id, but we store name in Customer)
  const [typeValue, setTypeValue] = useState("");
  const [memberStatusValue, setMemberStatusValue] = useState("");
  const [mobileNumbers, setMobileNumbers] = useState<string[]>([]);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<CustomerInput>({
    defaultValues: { name: "", mobileNumber: "", email: "", nikNumber: "", ktpAddress: "", type: "", club: "", memberStatus: "Non-Member", notes: "", bitrixId: "" },
  });

  useEffect(() => {
    if (open) {
      const tv = editCustomer?.type ?? "";
      const mv = editCustomer?.memberStatus ?? "Non-Member";
      setTypeValue(tv);
      setMemberStatusValue(mv);
      if (!editCustomer) {
        const draft = loadDraft();
        if (draft) {
          setMobileNumbers(draft.mobileNumbers ?? []);
          setTypeValue(draft.type ?? "");
          setMemberStatusValue(draft.memberStatus ?? "Non-Member");
          form.reset({ name: draft.name, mobileNumber: draft.mobileNumbers.join(","), email: draft.email, nikNumber: draft.nikNumber, ktpAddress: draft.ktpAddress, type: draft.type, club: draft.club, memberStatus: draft.memberStatus, notes: draft.notes, bitrixId: "" });
          return;
        }
      }
      setMobileNumbers(editCustomer?.mobileNumber ? editCustomer.mobileNumber.split(",").map((n) => n.trim()).filter(Boolean) : []);
      form.reset({
        name: editCustomer?.name ?? "",
        mobileNumber: editCustomer?.mobileNumber ?? "",
        email: editCustomer?.email ?? "",
        nikNumber: editCustomer?.nikNumber ?? "",
        ktpAddress: editCustomer?.ktpAddress ?? "",
        type: tv,
        club: editCustomer?.club ?? "",
        memberStatus: mv,
        notes: editCustomer?.notes ?? "",
        bitrixId: editCustomer?.bitrixId ?? "",
      });
    }
  }, [open, editCustomer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save draft on every change (create mode only)
  useEffect(() => {
    if (!open || editCustomer) return;
    const values = form.getValues();
    saveDraft({ name: values.name, mobileNumbers, email: values.email, nikNumber: values.nikNumber ?? "", ktpAddress: values.ktpAddress ?? "", type: values.type, club: values.club ?? "", memberStatus: values.memberStatus, notes: values.notes ?? "" });
  }); // intentionally no deps — runs on every render

  async function handleAddSourceOfInfo(name: string) {
    const result = await createSourceOfInformation(name);
    if (!result.success) { toast.error(result.error); return; }
    qc.invalidateQueries({ queryKey: ["source-of-informations"] });
    // Select the newly added item
    setTypeValue(name);
    form.setValue("type", name);
    toast.success(`"${name}" ditambahkan.`);
  }

  async function handleAddMemberStatus(name: string) {
    const result = await createMemberStatus(name);
    if (!result.success) { toast.error(result.error); return; }
    qc.invalidateQueries({ queryKey: ["member-statuses"] });
    setMemberStatusValue(name);
    form.setValue("memberStatus", name);
    toast.success(`"${name}" ditambahkan.`);
  }

  // Convert name-based value to option id for SearchableSelect
  function nameToId(options: OptionItem[], name: string) {
    return options.find((o) => o.name === name)?.id ?? name;
  }

  function idToName(options: OptionItem[], id: string) {
    return options.find((o) => o.id === id)?.name ?? id;
  }

  async function onSubmit(values: CustomerInput) {
    if (mobileNumbers.length === 0) { toast.error("Nomor HP wajib diisi"); return; }
    const payload = { ...values, mobileNumber: mobileNumbers.join(",") };
    const parsed = customerSchema.safeParse(payload);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }

    const result = isEdit
      ? await updateMut.mutateAsync({ id: editCustomer!.id, ...parsed.data })
      : await createMut.mutateAsync(parsed.data);

    if (!result.success) { toast.error(result.error); return; }
    clearDraft();
    toast.success(isEdit ? "Customer diperbarui." : "Customer ditambahkan.");
    onOpenChange(false);
  }

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <Drawer isOpen={open} onClose={() => onOpenChange(false)} title={isEdit ? "Edit Customer" : "Tambah Customer"}>
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto">
          <Form {...form}>
            <form className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Nama Lengkap *</FormLabel><FormControl>
                  <Input {...field} placeholder="e.g. John Doe & Jane Doe" />
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormItem>
                <FormLabel>No. HP *</FormLabel>
                <div className="flex flex-wrap gap-2 bg-white border border-gray-300 rounded-lg px-2 py-2">
                  {mobileNumbers.map((num, idx) => (
                    <span key={idx} className="flex items-center bg-[#FAFAFA] border rounded-lg px-3 text-sm font-normal text-black gap-2">
                      {num}
                      <button type="button" className="ml-1 text-red-600 hover:bg-red-100 rounded-full p-1" onClick={() => setMobileNumbers((prev) => prev.filter((_, i) => i !== idx))}>
                        <X className="w-4 h-4" />
                      </button>
                    </span>
                  ))}
                  <input
                    ref={mobileInputRef}
                    type="text"
                    inputMode="numeric"
                    className="flex-1 min-w-30 border-none outline-none bg-transparent text-sm px-2"
                    placeholder="e.g. 081234567890"
                    onKeyDown={(e) => {
                      const val = e.currentTarget.value.trim().replace(/\D/g, "");
                      if ((e.key === "Enter" || e.key === ",") && val) {
                        e.preventDefault();
                        if (!mobileNumbers.includes(val)) setMobileNumbers((prev) => [...prev, val]);
                        e.currentTarget.value = "";
                      }
                    }}
                  />
                </div>
              </FormItem>
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email *</FormLabel><FormControl>
                  <Input {...field} placeholder="nama@email.com" />
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="nikNumber" render={({ field }) => (
                <FormItem><FormLabel>NIK (16 digit)</FormLabel><FormControl>
                  <Input {...field} placeholder="3275010101010001" inputMode="numeric" maxLength={16}
                    onChange={(e) => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 16))} />
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="ktpAddress" render={({ field }) => (
                <FormItem><FormLabel>Alamat KTP</FormLabel><FormControl>
                  <Textarea {...field} placeholder="Jl. Melati No. 10, Jakarta Selatan" rows={2} />
                </FormControl><FormMessage /></FormItem>
              )} />

              {/* Type — SearchableSelect from source_of_informations */}
              <FormField control={form.control} name="bitrixId" render={({ field }) => (
                <FormItem><FormLabel>Bitrix ID</FormLabel><FormControl>
                  <Input {...field} placeholder="e.g. 12345" />
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Source of Information *</FormLabel>
                  <SearchableSelect
                    options={sourceOptions}
                    value={nameToId(sourceOptions, field.value)}
                    onChange={(id) => {
                      const name = idToName(sourceOptions, id);
                      setTypeValue(name);
                      field.onChange(name);
                    }}
                    placeholder="Pilih atau tambah sumber lead..."
                    searchPlaceholder="Cari sumber..."
                    emptyText="Tidak ada data"
                    onAdd={handleAddSourceOfInfo}
                    addingLabel="Menambahkan..."
                  />
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="club" render={({ field }) => (
                <FormItem><FormLabel>Club (opsional)</FormLabel><FormControl>
                  <Input {...field} />
                </FormControl><FormMessage /></FormItem>
              )} />

              {/* Member Status — SearchableSelect from customer_member_statuses */}
              <FormField control={form.control} name="memberStatus" render={({ field }) => (
                <FormItem>
                  <FormLabel>Member Status</FormLabel>
                  <SearchableSelect
                    options={memberStatusOptions}
                    value={nameToId(memberStatusOptions, field.value)}
                    onChange={(id) => {
                      const name = idToName(memberStatusOptions, id);
                      setMemberStatusValue(name);
                      field.onChange(name);
                    }}
                    placeholder="Pilih atau tambah status..."
                    searchPlaceholder="Cari status..."
                    emptyText="Tidak ada data"
                    onAdd={handleAddMemberStatus}
                    addingLabel="Menambahkan..."
                  />
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notes</FormLabel><FormControl>
                  <Input {...field} placeholder="Prefer tanggal weekend..." />
                </FormControl><FormMessage /></FormItem>
              )} />
            </form>
          </Form>
        </div>
        <div className="sticky bottom-0 bg-white pt-4">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 cursor-pointer text-red-600 border-red-600 hover:bg-red-50" disabled={isPending}>
              Batal
            </Button>
            <Button onClick={form.handleSubmit(onSubmit)} className="flex-1 bg-black text-white hover:bg-gray-800 cursor-pointer" disabled={isPending}>
              {isPending ? "Menyimpan..." : isEdit ? "Simpan" : "Tambah"}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
