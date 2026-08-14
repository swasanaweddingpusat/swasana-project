"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  WalletMoney,
  AltArrowDown,
  CheckCircle,
  Refresh,
} from "@solar-icons/react";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { createPayable } from "@/actions/customer-payout";
import { createPayableSchema, type CreatePayableInput } from "@/lib/validations/customer-payout";
import type { BookingPickerItem } from "@/lib/queries/ledger";

/* ─── Constants ──────────────────────────────────────────────────────────────── */

const TYPE_OPTIONS: { value: CreatePayableInput["type"]; label: string }[] = [
  { value: "program_cashback", label: "Cashback Program" },
  { value: "overpay_refund", label: "Refund Overpay" },
];

/* ─── Props ──────────────────────────────────────────────────────────────────── */

interface CreatePayableDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  bookings: BookingPickerItem[];
}

/* ─── Helpers ─────────────────────────────────────────────────────────────────── */

function FieldError({ message }: { message?: string }): React.ReactElement | null {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

function RequiredMark(): React.ReactElement {
  return (
    <span className="ml-0.5 text-destructive" aria-hidden="true">
      *
    </span>
  );
}

/* ─── Searchable booking combobox ────────────────────────────────────────────── */

function BookingCombobox({
  options,
  value,
  onChange,
  id,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  id?: string;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between rounded-xl font-normal"
          >
            {selected ? (
              <span className="truncate">{selected.label}</span>
            ) : (
              <span className="text-muted-foreground">Pilih client / booking</span>
            )}
            <AltArrowDown weight="BoldDuotone" className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-[calc(100vw-2rem)] p-0 sm:w-96" align="start">
        <Command>
          <CommandInput placeholder="Cari client..." autoFocus />
          <CommandList>
            <CommandEmpty>Tidak ada booking ditemukan.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <CheckCircle
                    weight="BoldDuotone"
                    className={cn(
                      "mr-2 size-4 shrink-0",
                      value === opt.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="flex-1 truncate">{opt.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────────── */

export function CreatePayableDrawer({
  isOpen,
  onClose,
  onSuccess,
  bookings,
}: CreatePayableDrawerProps): React.ReactElement {
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    register,
    reset,
    formState: { errors },
  } = useForm<CreatePayableInput>({
    resolver: zodResolver(createPayableSchema),
    defaultValues: {
      bookingId: "",
      type: "program_cashback",
      amount: 0,
      notes: "",
    },
  });

  useEffect(() => {
    if (isOpen) {
      reset({
        bookingId: "",
        type: "program_cashback",
        amount: 0,
        notes: "",
      });
    }
  }, [isOpen, reset]);

  const bookingOptions = bookings.map((b) => ({ value: b.id, label: b.clientName }));

  async function onValid(data: CreatePayableInput): Promise<void> {
    setSubmitting(true);
    const result = await createPayable(data);
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Payable berhasil dibuat");
    reset();
    onClose();
    onSuccess();
  }

  function handleClose(): void {
    reset();
    onClose();
  }

  return (
    <Drawer isOpen={isOpen} onClose={handleClose} title="Buat Customer Payout" maxWidth="sm:max-w-lg">
      <form
        onSubmit={(e) => {
          void handleSubmit(onValid)(e);
        }}
        className="flex h-full flex-col"
      >
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto pb-4">
          {/* Section header */}
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <WalletMoney weight="BoldDuotone" className="size-3.5" />
            Detail Payable
          </p>

          {/* Booking */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cp-booking">
              Client / Booking
              <RequiredMark />
            </Label>
            <Controller
              name="bookingId"
              control={control}
              render={({ field }) => (
                <BookingCombobox
                  id="cp-booking"
                  options={bookingOptions}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <FieldError message={errors.bookingId?.message} />
          </div>

          {/* Type */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cp-type">
              Tipe Payable
              <RequiredMark />
            </Label>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="cp-type" className="w-full rounded-xl">
                    <SelectValue placeholder="Pilih tipe" />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError message={errors.type?.message} />
          </div>

          {/* Amount */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cp-amount">
              Jumlah (Rp)
              <RequiredMark />
            </Label>
            <Input
              id="cp-amount"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              placeholder="0"
              className="w-full rounded-xl"
              {...register("amount", { valueAsNumber: true })}
            />
            <FieldError message={errors.amount?.message} />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cp-notes">Catatan</Label>
            <Textarea
              id="cp-notes"
              className="w-full"
              placeholder="Keterangan tambahan (opsional)"
              {...register("notes")}
            />
            <FieldError message={errors.notes?.message} />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-background pt-4">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={handleClose}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button type="submit" className="rounded-full" disabled={submitting}>
            {submitting ? (
              <Refresh weight="BoldDuotone" className="size-4 animate-spin" />
            ) : (
              <WalletMoney weight="BoldDuotone" className="size-4" />
            )}
            Simpan Payable
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
