"use client";

import type { PayslipDetail } from "@/lib/queries/payslips";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Download } from "@solar-icons/react";
import { cn } from "@/lib/utils";

// ─── Helpers ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const formatIDR = (amount: unknown): string =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Number(amount));

// ─── Props ───────────────────────────────────────────────────────────────────

interface PayslipCardProps {
  payslip: NonNullable<PayslipDetail>;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function LineItem({
  label,
  amount,
  isBold,
}: {
  label: string;
  amount: unknown;
  isBold?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-1.5 ${isBold ? "font-semibold border-t pt-2.5 mt-1" : ""}`}
    >
      <span className={`text-sm ${isBold ? "" : "text-muted-foreground"}`}>{label}</span>
      <span className="text-sm font-mono">{formatIDR(amount)}</span>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function PayslipCard({ payslip }: PayslipCardProps) {
  const period = payslip.payrollPeriod;
  const periodLabel = `${MONTH_NAMES[(period.month ?? 1) - 1]} ${period.year}`;

  const earningItems = payslip.items.filter((i) => i.type === "earning");
  const deductionItems = payslip.items.filter((i) => i.type === "deduction");

  const pdfHref = payslip.pdfUrl ?? `/api/hr/payslips/${payslip.id}/pdf`;

  return (
    <Card className="rounded-2xl shadow-sm overflow-hidden">
      {/* ── Header ── */}
      <div className="border-b bg-muted/30 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-heading text-xl font-bold tracking-wide">SWASANA</h2>
            <p className="mt-0.5 text-sm text-muted-foreground font-medium uppercase tracking-widest">
              Slip Gaji
            </p>
            <p className="mt-1 text-base font-semibold">{periodLabel}</p>
          </div>
          <a
            href={pdfHref}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline" }), "rounded-full gap-1.5 shrink-0")}
          >
            <Download weight="BoldDuotone" className="h-4 w-4" />
            Download PDF
          </a>
        </div>

        {/* Employee Info Grid */}
        <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
          <InfoRow label="Nama" value={payslip.employeeName} />
          <InfoRow label="No. Karyawan" value={String(payslip.employeeNumber)} />
          <InfoRow label="Departemen" value={payslip.departmentName ?? "-"} />
          <InfoRow label="Posisi" value={payslip.positionName ?? "-"} />
          <InfoRow label="NPWP" value={payslip.npwp ?? "-"} />
          <InfoRow label="Status PTKP" value={payslip.ptkpStatus ?? "-"} />
        </div>
      </div>

      <CardContent className="p-6 space-y-6">
        {/* ── Pendapatan ── */}
        <div>
          <h3 className="font-heading font-semibold text-base mb-2">Pendapatan</h3>
          <div className="divide-y divide-border/50">
            {earningItems.map((item) => (
              <LineItem key={item.id} label={item.name} amount={item.amount} />
            ))}
          </div>
          <LineItem label="Total Pendapatan" amount={payslip.totalEarnings} isBold />
        </div>

        <Separator />

        {/* ── Potongan ── */}
        <div>
          <h3 className="font-heading font-semibold text-base mb-2">Potongan</h3>
          <div className="divide-y divide-border/50">
            {deductionItems.map((item) => (
              <LineItem key={item.id} label={item.name} amount={item.amount} />
            ))}
          </div>
          <LineItem label="Total Potongan" amount={payslip.totalDeductions} isBold />
        </div>

        <Separator />

        {/* ── Ringkasan Kehadiran ── */}
        <div>
          <h3 className="font-heading font-semibold text-base mb-3">Ringkasan Kehadiran</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: "Hari Kerja", value: payslip.totalWorkDays },
              { label: "Hadir", value: payslip.totalPresent },
              { label: "Absen", value: payslip.totalAbsent },
              { label: "Terlambat", value: payslip.totalLate },
              { label: "Cuti", value: payslip.totalLeave },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex flex-col items-center rounded-xl bg-muted/50 p-3 text-center"
              >
                <span className="font-heading text-xl font-bold">{value}</span>
                <span className="mt-0.5 text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Summary ── */}
        <div className="rounded-xl bg-muted p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Pendapatan</span>
            <span className="font-mono font-medium">{formatIDR(payslip.totalEarnings)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Potongan</span>
            <span className="font-mono font-medium text-destructive">
              - {formatIDR(payslip.totalDeductions)}
            </span>
          </div>
          <Separator className="my-2" />
          <div className="flex items-center justify-between">
            <span className="font-heading font-semibold text-sm">Gaji Bersih</span>
            <span className="font-heading text-2xl font-bold">{formatIDR(payslip.netSalary)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
