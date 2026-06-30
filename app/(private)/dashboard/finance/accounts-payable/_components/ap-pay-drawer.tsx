"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle, HandMoney, Wallet } from "@solar-icons/react";
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
import { CategoryChip, fmtRp } from "./ap-format";
import type { APPayable } from "@/types/finance";

interface ApPayDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  payable: APPayable | null;
}

const METHODS = ["Transfer BCA", "Transfer Mandiri", "Transfer BNI", "Cash", "E-Wallet"];

function InfoRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold text-foreground" : "text-foreground"}>{value}</span>
    </div>
  );
}

export function ApPayDrawer({ isOpen, onClose, payable }: ApPayDrawerProps) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(METHODS[0]);
  const [notes, setNotes] = useState("");
  const [ack, setAck] = useState(false);
  const [ackBy, setAckBy] = useState("");

  // Reset the form whenever a different payable is opened.
  useEffect(() => {
    if (payable) {
      setAmount(String(payable.outstanding));
      setMethod(METHODS[0]);
      setNotes("");
      setAck(false);
      setAckBy("");
    }
  }, [payable]);

  if (!payable) {
    return <Drawer isOpen={isOpen} onClose={onClose} title="Bayar Payable" maxWidth="sm:max-w-lg"><div /></Drawer>;
  }

  const locked = !payable.eventDone && payable.category === "tunjangan-wp";
  const amountNum = Number(amount.replace(/[^\d]/g, "")) || 0;
  const overpay = amountNum > payable.outstanding;
  const invalid = amountNum <= 0 || overpay || (ack && !ackBy.trim());

  function handleSubmit() {
    // UI-first: no persistence yet. Wire to a server action once the schema lands.
    toast.success(
      ack
        ? `Pembayaran ${fmtRp(amountNum)} dicatat + di-acknowledge`
        : `Pembayaran ${fmtRp(amountNum)} dicatat`,
      { duration: 2000 },
    );
    onClose();
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Bayar Payable" maxWidth="sm:max-w-lg">
      <div className="flex flex-col gap-5 px-1 pb-6">
        {/* Payable summary */}
        <section className="rounded-xl border border-border bg-secondary/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <CategoryChip category={payable.category} />
            <span className="text-xs text-muted-foreground">Jatuh tempo {payable.dueDate}</span>
          </div>
          <p className="text-sm font-semibold text-foreground">{payable.title}</p>
          <p className="mb-2 text-xs text-muted-foreground">{payable.payeeName}</p>
          <Separator className="my-2" />
          <InfoRow label="Nominal" value={fmtRp(payable.amount)} />
          <InfoRow label="Sudah dibayar" value={fmtRp(payable.paidAmount)} />
          <InfoRow label="Outstanding" value={fmtRp(payable.outstanding)} strong />
        </section>

        {locked ? (
          <div className="flex items-start gap-2 rounded-xl border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
            <Wallet weight="BoldDuotone" className="mt-0.5 size-4 shrink-0" />
            <p>
              Tunjangan WP hanya bisa dibayar setelah event <span className="font-medium text-foreground">selesai</span>.
              Payable ini masih On Hold.
            </p>
          </div>
        ) : (
          <>
            {/* Payment input */}
            <section className="flex flex-col gap-3">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <HandMoney weight="BoldDuotone" className="size-3.5" /> Input Pembayaran
              </p>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ap-amount">Nominal Bayar</Label>
                <Input
                  id="ap-amount"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  aria-invalid={overpay}
                  placeholder="0"
                />
                {overpay && (
                  <p className="text-xs text-destructive">Nominal melebihi outstanding ({fmtRp(payable.outstanding)}).</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Metode Bayar</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ap-notes">Catatan</Label>
                <Textarea
                  id="ap-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Opsional — no. referensi transfer, dll"
                />
              </div>
            </section>

            <Separator />

            {/* Acknowledgment */}
            <section className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setAck((v) => !v)}
                className="flex items-start gap-2.5 text-left"
              >
                <span
                  className={
                    ack
                      ? "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
                      : "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border border-border"
                  }
                >
                  {ack && <CheckCircle weight="BoldDuotone" className="size-3.5" />}
                </span>
                <span>
                  <span className="block text-sm font-medium text-foreground">Acknowledge penerimaan</span>
                  <span className="block text-xs text-muted-foreground">
                    Tandai bahwa penerima sudah konfirmasi menerima dana ini.
                  </span>
                </span>
              </button>

              {ack && (
                <div className="flex flex-col gap-1.5 pl-7">
                  <Label htmlFor="ap-ackby">Di-acknowledge oleh</Label>
                  <Input
                    id="ap-ackby"
                    value={ackBy}
                    onChange={(e) => setAckBy(e.target.value)}
                    placeholder="Nama penerima / PIC"
                  />
                </div>
              )}
            </section>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="outline" className="rounded-full" onClick={onClose}>
                Batal
              </Button>
              <Button className="rounded-full" disabled={invalid} onClick={handleSubmit}>
                <HandMoney weight="BoldDuotone" className="size-4" />
                Catat Pembayaran
              </Button>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
