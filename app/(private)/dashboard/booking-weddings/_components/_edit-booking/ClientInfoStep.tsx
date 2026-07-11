"use client";

import { toast } from "sonner";
import { CloseCircle } from "@solar-icons/react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ContactEntry, parseStoredPhone } from "@/components/shared/PhoneInput";
import { LBL } from "./useEditBookingForm";
import type { EditBookingForm } from "./useEditBookingForm";

// ─── ClientInfoStep ───────────────────────────────────────────────────────────

export function ClientInfoStep({ form }: { form: EditBookingForm }) {
  const {
    customerName, setCustomerName,
    contactNumbers, setContactNumbers,
    contactInput, setContactInput,
    contactPopoverOpen, setContactPopoverOpen,
    contactEmailCpp, setContactEmailCpp,
    contactEmailCpw, setContactEmailCpw,
    contactNikCpp, setContactNikCpp,
    contactNikCpw, setContactNikCpw,
    contactCppAddress, setContactCppAddress,
    contactCpwAddress, setContactCpwAddress,
    contactBitrixId, setContactBitrixId,
    sourceOfInformationId, setSourceOfInformationId,
    salesId, setSalesId,
    salesUsers,
    sources,
    isSalesPIC,
    isBitrixSource,
    lockedSalesName,
  } = form;

  return (
    <div className="space-y-4">

      {/* Card 1: Identitas Client */}
      <div className="rounded-2xl border bg-card p-5 space-y-3">
        <p className="text-sm font-semibold text-foreground mb-1">Identitas Client</p>

        <div>
          <label className={LBL}>Nama Customer <span className="text-destructive">*</span></label>
          <Input className="mt-1" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" />
        </div>

        {/* Contact Person */}
        <div>
          <label className={LBL}>Contact Person <span className="text-destructive">*</span></label>
          <div className="mt-1 rounded-lg bg-muted p-3 space-y-2">
            {contactNumbers.map((entry, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md bg-background border px-3 py-2">
                <div className="flex-1 min-w-0">
                  {entry.name && <p className="text-xs text-muted-foreground">{entry.name}</p>}
                  <p className="text-sm font-medium">+{entry.number}</p>
                </div>
                <button
                  type="button"
                  className="shrink-0 text-destructive hover:bg-destructive/10 rounded-full p-1"
                  onClick={() => setContactNumbers((p) => p.filter((_, j) => j !== i))}
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
                <Button type="button" variant="outline" className="shrink-0 bg-background w-full text-xs h-8">
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
                  onAdd={() => {
                    const stored = contactInput.phone.trim();
                    const label = contactInput.name.trim();
                    const { nationalNumber } = parseStoredPhone(stored);
                    if (!label) { toast.error("Label wajib diisi"); return; }
                    if (nationalNumber.length < 7) return;
                    if (contactNumbers.some((c) => c.number === stored)) { toast.error("Nomor sudah ada"); return; }
                    setContactNumbers((prev) => [...prev, { name: label, number: stored }]);
                    setContactInput({ name: "", phone: "" });
                    setContactPopoverOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Card 2: Sales & Sumber */}
      <div className="rounded-2xl border bg-card p-5 space-y-3">
        <p className="text-sm font-semibold text-foreground mb-1">Sales & Sumber</p>

        {/* Sales PIC */}
        {isSalesPIC ? (
          <div>
            <label className={LBL}>Sales PIC</label>
            <div className="mt-1 flex h-9 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-foreground cursor-not-allowed select-none">
              {lockedSalesName}
            </div>
          </div>
        ) : (
          <div>
            <label className={LBL}>Sales PIC</label>
            <SearchableSelect
              options={salesUsers.map((u) => ({ id: u.id, name: u.fullName ?? "" }))}
              value={salesId ?? ""}
              onChange={(id) => setSalesId(id || null)}
              placeholder="Pilih sales..."
              searchPlaceholder="Cari sales..."
              emptyText="Sales tidak ditemukan"
            />
          </div>
        )}

        <div>
          <label className={LBL}>Sumber Informasi</label>
          <SearchableSelect
            options={sources}
            value={sourceOfInformationId}
            onChange={(id) => {
              setSourceOfInformationId(id);
              const isBitrix = sources.find((o) => o.id === id)?.name.toLowerCase().includes("bitrix") ?? false;
              if (!isBitrix) setContactBitrixId("");
            }}
            placeholder="Pilih sumber informasi"
            searchPlaceholder="Cari sumber..."
            emptyText="Tidak ada data"
          />
        </div>

        {isBitrixSource && (
          <div>
            <label className={LBL}>
              Bitrix ID <span className="text-destructive">*</span>
            </label>
            <Input className="mt-1" value={contactBitrixId} onChange={(e) => setContactBitrixId(e.target.value)} placeholder="Bitrix ID" />
          </div>
        )}
      </div>

      {/* Card 3: Data CPP & CPW */}
      <div className="rounded-2xl border bg-card p-5 space-y-3">
        <p className="text-sm font-semibold text-foreground mb-1">Data CPP & CPW</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LBL}>Email CPP</label>
            <Input className="mt-1" value={contactEmailCpp} onChange={(e) => setContactEmailCpp(e.target.value)} placeholder="Email CPP" />
          </div>
          <div>
            <label className={LBL}>Email CPW</label>
            <Input className="mt-1" value={contactEmailCpw} onChange={(e) => setContactEmailCpw(e.target.value)} placeholder="Email CPW" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LBL}>NIK CPP</label>
            <Input
              className="mt-1"
              value={contactNikCpp}
              onChange={(e) => setContactNikCpp(e.target.value.replace(/\D/g, "").slice(0, 16))}
              inputMode="numeric"
              maxLength={16}
              placeholder="NIK CPP"
            />
          </div>
          <div>
            <label className={LBL}>NIK CPW</label>
            <Input
              className="mt-1"
              value={contactNikCpw}
              onChange={(e) => setContactNikCpw(e.target.value.replace(/\D/g, "").slice(0, 16))}
              inputMode="numeric"
              maxLength={16}
              placeholder="NIK CPW"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LBL}>Alamat CPP</label>
            <Textarea className="mt-1" rows={3} value={contactCppAddress} onChange={(e) => setContactCppAddress(e.target.value)} placeholder="Alamat CPP" />
          </div>
          <div>
            <label className={LBL}>Alamat CPW</label>
            <Textarea className="mt-1" rows={3} value={contactCpwAddress} onChange={(e) => setContactCpwAddress(e.target.value)} placeholder="Alamat CPW" />
          </div>
        </div>
      </div>

    </div>
  );
}
