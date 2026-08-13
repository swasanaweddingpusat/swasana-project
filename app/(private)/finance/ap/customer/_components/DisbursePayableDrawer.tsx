"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  HandMoney,
  InfoCircle,
  Refresh,
} from "@solar-icons/react";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { disbursePayable } from "@/actions/customer-payout";
import { disbursePayableSchema, type DisbursePayableInput } from "@/lib/validations/customer-payout";
import { fmtRp, getPayoutTypeBadge, StatusBadge } from "./payout-format";
import type { PayableRow } from "@/lib/queries/customer-payout";
import type { PaymentMethodPickerItem } from "@/lib/queries/payment-methods";

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

function todayISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function InfoRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-4 py-1 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold text-foreground" : "text-foreground"}>{value}</span>
    </div>
  );
}

/* ─── Props ──────────────────────────────────────────────────────────────────── */

interface DisbursePayableDrawerProps {
  target: PayableRow | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  paymentMethods: PaymentMethodPickerItem[];
}

/* ─── Main component ─────────────────────────────────────────────────────────── */

export function DisbursePayableDrawer({
  target,
  isOpen,
  onClose,
  onSuccess,
  paymentMethods,
}: DisbursePayableDrawerProps): React.ReactElement {
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    register,
    reset,
    formState: { errors },
  } = useForm<DisbursePayableInput>({
    resolver: zodResolver(disbursePayableSchema),
    defaultValues: {
      payableId: "",
      paymentMethodId: paymentMethods[0]?.id ?? "",
      occurredAt: todayISO(),
      notes: "",
    },
  });

  useEffect(() => {
    if (isOpen && target) {
      reset({
        payableId: target.id,
        paymentMethodId: paymentMethods[0]?.id ?? "",
        occurredAt: todayISO(),
        notes: "",
      });
    }
  }, [isOpen, target, reset, paymentMethods]);

  async function onValid(data: DisbursePayableInput): Promise<void> {
    setSubmitting(true);
    const result = await disbursePayable(data);
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`Dicairkan — ${result.data.disbursementNumber}`);
    reset();
    onClose();
    onSuccess();
  }

  function handleClose(): void {
    reset();
    onClose();
  }

  if (!target) return <></>;

  const typeBadge = getPayoutTypeBadge(target.type);

  return (
    <Drawer isOpen={isOpen} onClose={handleClose} title="Cairkan Payable" maxWidth="sm:max-w-lg">
      <form
        onSubmit={(e) => {
          void handleSubmit(onValid)(e);
        }}
        className="flex h-full flex-col"
      >
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto pb-4">
          {/* Ringkasan payable */}
          <div className="rounded-2xl border border-border bg-secondary/30 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ringkasan
            </p>
            <InfoRow label="Client" value={target.clientName} />
            <div className="flex items-center justify-between py-1 text-sm">
              <span className="shrink-0 text-muted-foreground">Tipe</span>
              <StatusBadge config={typeBadge} />
            </div>
            <Separator className="my-1.5" />
            <InfoRow label="Jumlah" value={fmtRp(target.amount)} strong />
          </div>

          {/* Disbursement number notice */}
          <div className="flex items-start gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-3 py-2.5">
            <InfoCircle weight="BoldDuotone" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Disbursement akan mencatat 1 baris kas keluar (Ledger) &amp; nomor AP otomatis.
            </p>
          </div>

          {/* Hidden payableId */}
          <input type="hidden" {...register("payableId")} />

          {/* Payment method */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dp-method">
              Rekening Tujuan
              <RequiredMark />
            </Label>
            <Controller
              name="paymentMethodId"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="dp-method" className="w-full rounded-xl">
                    <SelectValue placeholder="Pilih rekening" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((pm) => (
                      <SelectItem key={pm.id} value={pm.id}>
                        {pm.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError message={errors.paymentMethodId?.message} />
          </div>

          {/* Occurred at */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dp-date">
              Tanggal Disbursement
              <RequiredMark />
            </Label>
            <Input
              id="dp-date"
              type="date"
              className="w-full rounded-xl"
              {...register("occurredAt")}
            />
            <FieldError message={errors.occurredAt?.message} />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dp-notes">Catatan</Label>
            <Textarea
              id="dp-notes"
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
              <HandMoney weight="BoldDuotone" className="size-4" />
            )}
            Cairkan Sekarang
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
