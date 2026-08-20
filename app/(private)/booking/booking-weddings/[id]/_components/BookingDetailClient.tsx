"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  AltArrowLeft, UserRounded, CalendarMark, Wallet, UserId, Buildings, ClockCircle,
  Bill, Paperclip2, CardReceive, FileText, DownloadMinimalistic, Link as LinkIcon,
  Copy, CheckCircle,
} from "@solar-icons/react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { BookingActions } from "./BookingActions";
import type { BookingDetail } from "@/lib/queries/bookings";

/* ─── Resolved shape (server adds termStatuses/cashIns; docs carry fileUrl) ──── */

type TermStatus = "paid" | "partial" | "overdue" | "not_due_yet";
type AckStatus = "pending" | "acknowledged" | "rejected";

interface CashInView {
  id: string;
  amount: number;
  occurredAt: string;
  ackStatus: AckStatus;
  invoiceNumber: string | null;
  notes: string | null;
  linkedTermNames: string[];
  evidenceUrl: string | null;
}

export type BookingDetailResolved = BookingDetail & {
  termStatuses?: Record<string, TermStatus>;
  cashIns?: CashInView[];
};

interface PaymentSummary {
  totalValue: number;
  totalPaid: number;
  remaining: number;
  percent: number;
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

const lbl = "text-xs font-medium text-muted-foreground";
const val = "text-sm font-normal text-foreground";

function fmtPrice(v: number | null | undefined): string {
  if (v == null) return "-";
  return `Rp ${new Intl.NumberFormat("id-ID").format(Number(v))}`;
}

function fmtDate(d: string | Date | null | undefined, style: "short" | "long" = "short"): string {
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "-";
  if (style === "long") return date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  return format(date, "dd MMM yyyy");
}

function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "-";
  return format(date, "dd MMM yyyy HH:mm");
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function parsePhones(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      return arr.map((e: { name?: string; number: string }) => (e.name ? `${e.name}: ${e.number}` : e.number));
    }
  } catch {
    return raw.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function RichText({ html }: { html: string | null | undefined }) {
  if (!html || html === "<p></p>") return <span className="text-muted-foreground">-</span>;
  return (
    <div
      className="prose prose-sm max-w-none text-muted-foreground [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0 [&_p]:my-0 [&_strong]:text-foreground"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/* ─── Color maps (duplicated locally — no cross-file import per scope rule) ───── */

const STATUS_DOT: Record<string, string> = {
  Confirmed: "bg-primary",
  Uploaded: "bg-primary/60",
  Pending: "bg-muted-foreground/60",
  Rejected: "bg-destructive",
  Canceled: "bg-muted-foreground",
  Lost: "bg-muted-foreground",
};

const STATUS_TEXT: Record<string, string> = {
  Confirmed: "text-primary border-primary/20",
  Uploaded: "text-primary/70 border-border",
  Pending: "text-muted-foreground border-border",
  Rejected: "text-destructive border-destructive/30",
  Canceled: "text-muted-foreground border-border",
  Lost: "text-muted-foreground border-border",
};

const AGREEMENT_COLOR: Record<string, string> = {
  Pending: "bg-muted text-muted-foreground",
  Sent: "bg-primary/10 text-primary",
  Viewed: "bg-muted text-foreground/70",
  Signed: "bg-primary/20 text-primary",
};

const TERM_STATUS: Record<TermStatus, { label: string; className: string }> = {
  paid: { label: "Lunas", className: "bg-primary/15 text-primary" },
  partial: { label: "Sebagian", className: "bg-secondary text-foreground/70" },
  overdue: { label: "Jatuh tempo", className: "bg-destructive/10 text-destructive" },
  not_due_yet: { label: "Belum jatuh tempo", className: "bg-muted text-muted-foreground" },
};

const ACK_STATUS: Record<AckStatus, { label: string; className: string }> = {
  acknowledged: { label: "Terverifikasi", className: "bg-primary text-primary-foreground" },
  pending: { label: "Menunggu", className: "bg-secondary text-muted-foreground" },
  rejected: { label: "Ditolak", className: "bg-destructive/10 text-destructive" },
};

/* ─── Small building blocks ───────────────────────────────────────────────────── */

function InfoCard({
  title,
  icon,
  children,
  className = "",
  index = 0,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  index?: number;
}) {
  return (
    <div
      className={`group animate-in fade-in slide-in-from-bottom-3 rounded-2xl border bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md ${className}`}
      style={{ animationDuration: "500ms", animationDelay: `${index * 60}ms`, animationFillMode: "both" }}
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="text-muted-foreground transition-colors group-hover:text-primary">{icon}</span>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      </div>
      <div className="space-y-3.5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className={lbl}>{label}</p>
      <div className={val}>{children}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</p>
  );
}

/* ─── Component ────────────────────────────────────────────────────────────── */

interface Props {
  booking: BookingDetailResolved;
  payment: PaymentSummary;
}

export function BookingDetailClient({ booking, payment }: Props) {
  const isAgreementSigned = booking.clientAgreement?.status === "Signed";
  const bitrixId = booking.customer?.bitrixId?.trim() || null;

  const sourceLabel = booking.sourceOfInformation?.name
    ? booking.sourceOfInformation.name === "Bitrix" && bitrixId
      ? `${booking.sourceOfInformation.name} - ${bitrixId}`
      : booking.sourceOfInformation.name
    : "-";

  const status = booking.bookingStatus ?? "Pending";
  const dotClass = STATUS_DOT[status] ?? "bg-muted-foreground/60";
  const textClass = STATUS_TEXT[status] ?? "text-muted-foreground border-border";
  const customerName = booking.snapCustomer?.name ?? "Tanpa Nama";
  const barPercent = Math.min(payment.percent, 100);

  const tabs = [
    { key: "booking", label: "Booking" },
    { key: "vendor", label: "Vendor" },
    { key: "payment", label: "Pembayaran" },
    { key: "documents", label: "Dokumen" },
    ...(isAgreementSigned ? [{ key: "agreement", label: "Client Agreement" }] : []),
    ...(bitrixId ? [{ key: "bitrix", label: "Bitrix" }] : []),
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      {/* ── Toolbar: back link + actions (chat + approval) ─────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/booking/booking-weddings"
          className="group inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <AltArrowLeft weight="BoldDuotone" className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Kembali ke daftar booking
        </Link>
        <BookingActions
          bookingId={booking.id}
          customerName={customerName}
          currentRevisionId={booking.currentRevisionId ?? null}
          bookingStatus={status}
        />
      </div>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <div className="grid animate-in fade-in slide-in-from-bottom-2 gap-4 rounded-2xl border bg-gradient-to-br from-card to-muted/20 p-6 shadow-sm duration-500 lg:grid-cols-[1.4fr_1fr] lg:gap-8">
        {/* Identity */}
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-lg font-semibold text-primary-foreground shadow-sm ring-4 ring-primary/10">
            {initials(customerName)}
          </div>
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-0.5 text-xs font-medium ${textClass}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
                {status}
              </span>
              {booking.poNumber && (
                <span className="rounded-full bg-muted px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
                  {booking.poNumber}
                </span>
              )}
            </div>
            <h1 className="font-heading text-2xl font-semibold leading-tight text-foreground">
              {customerName}
            </h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarMark weight="BoldDuotone" className="h-4 w-4" />
                {fmtDate(booking.eventDate, "long")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Buildings weight="BoldDuotone" className="h-4 w-4" />
                {booking.snapVenue?.venueName ?? "-"}
              </span>
            </div>
          </div>
        </div>

        {/* Signature: payment progress */}
        <div className="flex flex-col justify-center rounded-2xl bg-gradient-to-br from-muted/60 to-muted/20 p-5 ring-1 ring-border/60">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className={lbl}>Sudah dibayar</p>
              <p className="font-heading text-2xl font-semibold tabular-nums text-foreground">
                {fmtPrice(payment.totalPaid)}
              </p>
            </div>
            <p className="font-heading text-2xl font-semibold tabular-nums text-primary">
              {payment.percent}%
            </p>
          </div>
          <Progress value={barPercent} className="mt-3" aria-label="Progres pembayaran" />
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Sisa {fmtPrice(payment.remaining)}</span>
            <span>Total {fmtPrice(payment.totalValue)}</span>
          </div>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="booking">
        <TabsList className="flex h-auto flex-wrap gap-1 rounded-full bg-muted p-1">
          {tabs.map((t) => (
            <TabsTrigger
              key={t.key}
              value={t.key}
              className="rounded-full px-4 py-1.5 transition-all data-active:bg-background data-active:text-foreground data-active:shadow-sm"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ═══ Booking ═══ */}
        <TabsContent value="booking" className="mt-5 animate-in fade-in duration-300">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InfoCard title="Customer" index={0} icon={<UserRounded weight="BoldDuotone" className="h-4 w-4" />}>
              <Field label="Nama">{customerName}</Field>
              <Field label="Sales PIC">{booking.sales?.fullName ?? "-"}</Field>
              <Field label="Email CPP">{booking.snapCustomer?.emailCpp ?? "-"}</Field>
              <Field label="Email CPW">{booking.snapCustomer?.emailCpw ?? "-"}</Field>
              <Field label="Nomor HP">
                {(() => {
                  const nums = parsePhones(booking.snapCustomer?.mobileNumber);
                  if (nums.length === 0) return "-";
                  if (nums.length === 1) return nums[0];
                  return <ul className="space-y-0.5">{nums.map((n, i) => <li key={i}>• {n}</li>)}</ul>;
                })()}
              </Field>
              <Field label="Sumber Informasi">{sourceLabel}</Field>
              {booking.sourceOfInformationDetail && (
                <Field label="Detail Sumber">{booking.sourceOfInformationDetail}</Field>
              )}
            </InfoCard>

            <InfoCard title="Event & Status" index={1} icon={<CalendarMark weight="BoldDuotone" className="h-4 w-4" />}>
              <Field label="Tanggal Event">{fmtDate(booking.eventDate, "long")}</Field>
              <Field label="Sesi">{booking.weddingSession ?? "-"}</Field>
              <Field label="Tipe Wedding">{booking.weddingType ?? "-"}</Field>
              <Field label="Status Booking">
                <span className="inline-flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
                  {status}
                </span>
              </Field>
              <Field label="Client Agreement">
                {booking.clientAgreement ? (
                  <Badge className={AGREEMENT_COLOR[booking.clientAgreement.status]}>
                    {booking.clientAgreement.status}
                  </Badge>
                ) : (
                  "-"
                )}
              </Field>
              {status === "Rejected" && booking.rejectionNotes && (
                <Field label="Catatan Penolakan">
                  <span className="text-muted-foreground">{booking.rejectionNotes}</span>
                </Field>
              )}
            </InfoCard>

            <InfoCard title="Harga & Paket" index={2} icon={<Wallet weight="BoldDuotone" className="h-4 w-4" />}>
              <Field label="Tipe Paket">{booking.snapPackage?.packageName ?? "-"}</Field>
              <Field label="Paket">
                {booking.snapPackagePricing?.packageName ?? "-"}
                {booking.snapPackagePricing?.pax ? ` (${booking.snapPackagePricing.pax} PAX)` : ""}
              </Field>
              <Field label="Harga Paket">{fmtPrice(booking.snapPackagePricing?.price)}</Field>
              <Field label="Metode Pembayaran">
                {booking.paymentMethod ? (
                  <div className="space-y-0.5">
                    <span className="block">{booking.paymentMethod.bankName}</span>
                    <span className="block text-xs text-muted-foreground">{booking.paymentMethod.bankAccountNumber}</span>
                    <span className="block text-xs text-muted-foreground">{booking.paymentMethod.bankRecipient}</span>
                  </div>
                ) : (
                  "-"
                )}
              </Field>
              <Field label="PO Number">{booking.poNumber ?? "-"}</Field>
            </InfoCard>

            <InfoCard title="Identitas (NIK & Alamat)" index={3} icon={<UserId weight="BoldDuotone" className="h-4 w-4" />}>
              <Field label={`${booking.snapCustomer?.cppIdType ?? "KTP"} CPP`}>{booking.snapCustomer?.cppNik ?? "-"}</Field>
              <Field label="Alamat CPP">{booking.snapCustomer?.cppAddress ?? "-"}</Field>
              <Field label={`${booking.snapCustomer?.cpwIdType ?? "KTP"} CPW`}>{booking.snapCustomer?.cpwNik ?? "-"}</Field>
              <Field label="Alamat CPW">{booking.snapCustomer?.cpwAddress ?? "-"}</Field>
            </InfoCard>

            <InfoCard title="Venue & Brand" index={4} icon={<Buildings weight="BoldDuotone" className="h-4 w-4" />}>
              <Field label="Venue">{booking.snapVenue?.venueName ?? "-"}</Field>
              <Field label="Alamat Venue">{booking.snapVenue?.address ?? "-"}</Field>
              <Field label="Brand">{booking.snapVenue?.brandName ?? "-"}</Field>
              <Field label="Manager">{booking.manager?.fullName ?? "-"}</Field>
            </InfoCard>

            <InfoCard title="Meta" index={5} icon={<ClockCircle weight="BoldDuotone" className="h-4 w-4" />}>
              <Field label="Dibuat">{fmtDate(booking.createdAt)}</Field>
              <Field label="Diperbarui">{fmtDate(booking.updatedAt)}</Field>
            </InfoCard>
          </div>
        </TabsContent>

        {/* ═══ Vendor ═══ */}
        <TabsContent value="vendor" className="mt-5 animate-in fade-in duration-300">
          <VendorSection booking={booking} />
        </TabsContent>

        {/* ═══ Pembayaran ═══ */}
        <TabsContent value="payment" className="mt-5 animate-in fade-in duration-300">
          <PaymentSection booking={booking} />
        </TabsContent>

        {/* ═══ Dokumen ═══ */}
        <TabsContent value="documents" className="mt-5 animate-in fade-in duration-300">
          <DocumentsSection booking={booking} />
        </TabsContent>

        {/* ═══ Client Agreement ═══ */}
        {isAgreementSigned && (
          <TabsContent value="agreement" className="mt-5 animate-in fade-in duration-300">
            <AgreementSection booking={booking} />
          </TabsContent>
        )}

        {/* ═══ Bitrix ═══ */}
        {bitrixId && (
          <TabsContent value="bitrix" className="mt-5 animate-in fade-in duration-300">
            <BitrixSection dealId={bitrixId} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

/* ─── Vendor section ─────────────────────────────────────────────────────────── */

function VendorSection({ booking }: { booking: BookingDetailResolved }) {
  const complimentaries =
    (booking as typeof booking & {
      snapComplimentaries?: { id: string; name: string; price: number; isShowPrice: boolean; qty: number; description?: string | null }[];
    }).snapComplimentaries ?? [];

  const hasAny =
    booking.snapVendorItems.length > 0 ||
    booking.snapBonuses.length > 0 ||
    booking.snapPackageInternalItems.length > 0 ||
    booking.snapPackageVendorItems.length > 0 ||
    complimentaries.length > 0;

  if (!hasAny) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border bg-card py-14 text-center shadow-sm">
        <FileText weight="BoldDuotone" className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Belum ada data vendor.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {(booking.snapVendorItems.length > 0 || booking.snapBonuses.length > 0) && (
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <SectionTitle>Vendor & Bonus</SectionTitle>
          <div className="overflow-hidden rounded-xl border [&_[data-slot=table-container]]:overflow-hidden">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[18%] px-4">Kategori</TableHead>
                  <TableHead className="w-[20%] px-4">Nama Vendor</TableHead>
                  <TableHead className="w-[15%] px-4">Nominal</TableHead>
                  <TableHead className="w-[32%] px-4">Keterangan</TableHead>
                  <TableHead className="w-[15%] px-4">Status Order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {booking.snapVendorItems.filter((v) => !v.isAddons).map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="whitespace-normal break-words px-4 text-sm font-medium text-foreground">{v.vendorCategoryName}</TableCell>
                    <TableCell className="whitespace-normal break-words px-4 text-sm">{v.vendorName}</TableCell>
                    <TableCell className="whitespace-normal px-4 text-sm">{Number(v.itemPrice) > 0 ? fmtPrice(Number(v.itemPrice)) : "-"}</TableCell>
                    <TableCell className="whitespace-normal break-words px-4 text-sm"><RichText html={v.description} /></TableCell>
                    <TableCell className="whitespace-normal break-words px-4 text-sm text-muted-foreground">{(v as typeof v & { orderStatus?: { name: string } | null }).orderStatus?.name ?? "-"}</TableCell>
                  </TableRow>
                ))}
                {booking.snapBonuses.length > 0 && (
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={5} className="whitespace-normal px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Complimentary / Bonus</TableCell>
                  </TableRow>
                )}
                {booking.snapBonuses.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="whitespace-normal break-words px-4 text-sm font-medium text-foreground">Complimentary</TableCell>
                    <TableCell className="whitespace-normal break-words px-4 text-sm">{b.vendorName}</TableCell>
                    <TableCell className="whitespace-normal px-4 text-sm">{Number((b as typeof b & { nominal?: number | null }).nominal ?? 0) > 0 ? fmtPrice(Number((b as typeof b & { nominal?: number | null }).nominal)) : "-"}</TableCell>
                    <TableCell className="whitespace-normal break-words px-4 text-sm"><RichText html={b.description} /></TableCell>
                    <TableCell className="whitespace-normal break-words px-4 text-sm text-muted-foreground">{b.orderStatus?.name ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {booking.snapPackageInternalItems.length > 0 && (
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <SectionTitle>Internal Items</SectionTitle>
          <div className="overflow-hidden rounded-xl border [&_[data-slot=table-container]]:overflow-hidden">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[35%] px-4">Nama Item</TableHead>
                  <TableHead className="px-4">Keterangan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {booking.snapPackageInternalItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-normal break-words px-4 align-top text-sm font-medium text-foreground">{item.itemName}</TableCell>
                    <TableCell className="whitespace-normal break-words px-4 text-sm">{item.itemDescription ? <RichText html={item.itemDescription} /> : <span className="text-muted-foreground">—</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {booking.snapPackageVendorItems.length > 0 && (
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <SectionTitle>Paket Vendor Items</SectionTitle>
          <div className="overflow-hidden rounded-xl border [&_[data-slot=table-container]]:overflow-hidden">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[35%] px-4">Kategori</TableHead>
                  <TableHead className="px-4">Item</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {booking.snapPackageVendorItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-normal break-words px-4 align-top text-sm font-medium text-foreground">{item.categoryName}</TableCell>
                    <TableCell className="whitespace-normal break-words px-4 text-sm"><RichText html={item.itemText} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {complimentaries.length > 0 && (
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <SectionTitle>Complimentary</SectionTitle>
          <div className="overflow-hidden rounded-xl border [&_[data-slot=table-container]]:overflow-hidden">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="px-4">Nama</TableHead>
                  <TableHead className="w-20 px-4">Qty</TableHead>
                  <TableHead className="w-37.5 px-4">Harga</TableHead>
                  <TableHead className="px-4">Keterangan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {complimentaries.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="whitespace-normal break-words px-4 text-sm font-medium text-foreground">{c.name}</TableCell>
                    <TableCell className="whitespace-normal px-4 text-sm">{c.qty}</TableCell>
                    <TableCell className="whitespace-normal px-4 text-sm">{c.isShowPrice ? fmtPrice(c.price) : <span className="text-muted-foreground">(Tersembunyi)</span>}</TableCell>
                    <TableCell className="whitespace-normal break-words px-4 text-sm"><RichText html={c.description} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Payment section ────────────────────────────────────────────────────────── */

function PaymentSection({ booking }: { booking: BookingDetailResolved }) {
  const termStatuses = booking.termStatuses ?? {};
  const cashIns = booking.cashIns ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Bill weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Jadwal Termin</p>
        </div>
        {booking.termOfPayments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada jadwal pembayaran.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Termin</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nominal</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Jatuh Tempo</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {booking.termOfPayments.map((t, i) => {
                  const st = TERM_STATUS[termStatuses[t.id] ?? "not_due_yet"];
                  return (
                    <tr key={t.id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium text-foreground">{t.name || `Termin ${i + 1}`}</td>
                      <td className="px-4 py-3 tabular-nums text-foreground">{fmtPrice(Number(t.amount))}</td>
                      <td className="px-4 py-3 text-foreground">{fmtDate(t.dueDate, "long")}</td>
                      <td className="px-4 py-3"><Badge className={st.className}>{st.label}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <CardReceive weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Riwayat Pembayaran</p>
        </div>
        {cashIns.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center">
            <p className="text-sm text-muted-foreground">Belum ada pembayaran tercatat.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tanggal</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nominal</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Termin</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Bukti</th>
                </tr>
              </thead>
              <tbody>
                {cashIns.map((ci) => {
                  const ack = ACK_STATUS[ci.ackStatus] ?? ACK_STATUS.pending;
                  return (
                    <tr key={ci.id} className="border-b align-top hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <p className="text-foreground">{fmtDate(ci.occurredAt, "long")}</p>
                        {ci.invoiceNumber && <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{ci.invoiceNumber}</p>}
                      </td>
                      <td className="px-4 py-3 font-medium tabular-nums text-foreground">{fmtPrice(ci.amount)}</td>
                      <td className="px-4 py-3">
                        {ci.linkedTermNames.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {ci.linkedTermNames.map((name, idx) => (
                              <span key={idx} className="inline-flex items-center rounded-full bg-secondary/60 px-2 py-0.5 text-[11px] text-foreground/70">{name}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                        {ci.notes && <p className="mt-1 text-xs text-muted-foreground">{ci.notes}</p>}
                      </td>
                      <td className="px-4 py-3"><Badge className={ack.className}>{ack.label}</Badge></td>
                      <td className="px-4 py-3">
                        {ci.evidenceUrl ? (
                          <a href={ci.evidenceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline">
                            <Paperclip2 weight="BoldDuotone" className="h-3.5 w-3.5" />
                            Lihat bukti
                          </a>
                        ) : (
                          <span className="text-muted-foreground">Tanpa bukti</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Documents section (READ-ONLY: view + download) ─────────────────────────── */

function DocumentsSection({ booking }: { booking: BookingDetailResolved }) {
  const docs = booking.bookingDocuments;
  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border bg-card py-14 text-center shadow-sm">
        <FileText weight="BoldDuotone" className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Belum ada dokumen.</p>
        <p className="mt-1 text-xs text-muted-foreground">Unggah dokumen lewat tabel booking.</p>
      </div>
    );
  }

  const grouped: Record<string, typeof docs> = {};
  docs.forEach((doc) => {
    (grouped[doc.name] ??= []).push(doc);
  });

  const download = async (url: string, fileName: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Object.entries(grouped).map(([docName, group]) => (
        <div key={docName} className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="truncate text-sm font-medium text-foreground">{docName}</p>
          {group[0]?.description && <p className="mt-0.5 text-xs text-muted-foreground">{group[0].description}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {group.map((doc) => {
              const url = (doc as typeof doc & { fileUrl?: string }).fileUrl ?? "";
              const isImage = doc.fileType?.startsWith("image/");
              const ext = doc.fileName?.split(".").pop() ?? "FILE";
              return (
                <div key={doc.id} className="w-25 overflow-hidden rounded-xl border bg-card">
                  <button
                    type="button"
                    onClick={() => { if (url) window.open(url, "_blank", "noopener,noreferrer"); }}
                    className="flex h-20 w-full items-center justify-center overflow-hidden bg-muted/50"
                  >
                    {isImage && url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt={doc.fileName} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <FileText weight="BoldDuotone" className="h-6 w-6 text-muted-foreground" />
                        <span className="text-[9px] font-medium uppercase text-muted-foreground">{ext}</span>
                      </div>
                    )}
                  </button>
                  <div className="px-1.5 py-1">
                    <div className="flex items-center justify-between gap-0.5">
                      <p className="flex-1 truncate text-[10px] text-foreground">{doc.fileName}</p>
                      <button
                        type="button"
                        onClick={() => download(url, doc.fileName)}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        aria-label="Unduh"
                      >
                        <DownloadMinimalistic weight="BoldDuotone" className="h-2.5 w-2.5" />
                      </button>
                    </div>
                    <p className="text-[9px] text-muted-foreground">
                      {doc.fileSize < 1024 * 1024 ? `${(doc.fileSize / 1024).toFixed(1)} KB` : `${(doc.fileSize / (1024 * 1024)).toFixed(1)} MB`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Client Agreement section (READ-ONLY summary) ───────────────────────────── */

function AgreementSection({ booking }: { booking: BookingDetailResolved }) {
  const agreement = booking.clientAgreement;
  const clientSignature = booking.clientSignature ?? null;
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const agreementUrl = agreement ? `${baseUrl}/client-agreement?token=${agreement.token}` : null;

  if (!agreement) return null;

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} disalin`);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle weight="BoldDuotone" className="h-5 w-5 text-primary" />
          <p className="text-sm font-semibold text-foreground">Client Agreement</p>
        </div>
        <Badge className={AGREEMENT_COLOR[agreement.status]}>{agreement.status}</Badge>
      </div>

      {agreementUrl && (
        <div className="space-y-1">
          <p className={lbl}>Link Agreement</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-xl border bg-muted/50 px-3 py-2 text-xs">{agreementUrl}</code>
            <button
              type="button"
              onClick={() => copy(agreementUrl, "Link")}
              className="shrink-0 rounded-full border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Salin link"
            >
              <Copy weight="BoldDuotone" className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-1">
        <p className={lbl}>Kode Akses</p>
        <div className="flex items-center gap-2">
          <code className="rounded-xl border bg-muted/50 px-3 py-2 font-mono text-lg font-bold tracking-widest">{agreement.accessCode}</code>
          <button
            type="button"
            onClick={() => copy(agreement.accessCode, "Kode")}
            className="shrink-0 rounded-full border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Salin kode"
          >
            <Copy weight="BoldDuotone" className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-0.5 text-xs text-muted-foreground">
        {agreement.sentAt && <p>Dikirim: {fmtDateTime(agreement.sentAt)}</p>}
        {agreement.viewedAt && <p>Dilihat: {fmtDateTime(agreement.viewedAt)}</p>}
        {agreement.signedAt && <p>Ditandatangani: {fmtDateTime(agreement.signedAt)}</p>}
      </div>

      {clientSignature && (
        <div className="space-y-1.5">
          <p className={lbl}>Tanda Tangan Client</p>
          <div className="w-fit rounded-xl border bg-card p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={clientSignature} alt="Tanda tangan client" className="max-h-24 max-w-48 object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Bitrix section (client-side fetch of linked deal) ──────────────────────── */

interface BitrixDeal {
  id: string;
  title: string;
  stage: string;
  stageSemantic: "won" | "lost" | "process";
  pipeline: string;
  client: string | null;
  phone: string | null;
  opportunity: number;
  currency: string;
  source: string;
  sourceDescription: string | null;
  assignedBy: string | null;
  issue: string | null;
  adsUrl: string | null;
  adsHeadline: string | null;
  adsBody: string | null;
  dateCreate: string | null;
}

const BITRIX_SEMANTIC_STYLE: Record<BitrixDeal["stageSemantic"], string> = {
  won: "bg-primary/15 text-primary",
  lost: "bg-destructive/10 text-destructive",
  process: "bg-muted text-foreground/70",
};

function BitrixField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className={lbl}>{label}</p>
      <div className={val}>{children}</div>
    </div>
  );
}

function BitrixSection({ dealId }: { dealId: string }) {
  const [deal, setDeal] = useState<BitrixDeal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/bitrix/deals?filter[ID]=${encodeURIComponent(dealId)}`)
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as { items?: BitrixDeal[]; error?: string } | null;
        if (cancelled) return;
        if (!res.ok || !json) {
          setError(json?.error ?? "Gagal mengambil data Bitrix.");
          return;
        }
        const found = json.items?.[0] ?? null;
        if (!found) {
          setError(`Deal dengan ID ${dealId} tidak ditemukan di Bitrix.`);
          return;
        }
        setDeal(found);
      })
      .catch(() => {
        if (!cancelled) setError("Gagal menghubungi Bitrix.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dealId]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 rounded-2xl border bg-card p-6 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
        <p className="text-sm text-muted-foreground">{error}</p>
        <p className="mt-1 text-xs text-muted-foreground">Bitrix ID: {dealId}</p>
      </div>
    );
  }

  if (!deal) return null;

  return (
    <div className="space-y-5 rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-foreground">{deal.title}</h3>
        <Badge className={BITRIX_SEMANTIC_STYLE[deal.stageSemantic]}>{deal.stage}</Badge>
      </div>
      <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        <BitrixField label="Deal ID">{deal.id}</BitrixField>
        <BitrixField label="Pipeline">{deal.pipeline}</BitrixField>
        <BitrixField label="Stage">{deal.stage}</BitrixField>
        <BitrixField label="Client">{deal.client ?? "-"}</BitrixField>
        <BitrixField label="Phone">{deal.phone ?? "-"}</BitrixField>
        <BitrixField label="Nilai (Opportunity)">{deal.opportunity ? fmtPrice(deal.opportunity) : "-"}</BitrixField>
        <BitrixField label="Source">
          <span>{deal.source}</span>
          {deal.adsUrl && (
            <a href={deal.adsUrl} target="_blank" rel="noopener noreferrer" className="mt-0.5 flex items-center gap-1 text-primary hover:underline break-all">
              <LinkIcon weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{deal.adsUrl}</span>
            </a>
          )}
        </BitrixField>
        <BitrixField label="Source Description">{deal.sourceDescription ?? "-"}</BitrixField>
        <BitrixField label="PIC (Assigned)">{deal.assignedBy ?? "-"}</BitrixField>
        <BitrixField label="Issue">{deal.issue ?? "-"}</BitrixField>
        <BitrixField label="Ads Headline">{deal.adsHeadline ?? "-"}</BitrixField>
        <BitrixField label="Dibuat">{fmtDateTime(deal.dateCreate)}</BitrixField>
        {deal.adsBody && (
          <div className="sm:col-span-2 lg:col-span-3">
            <p className={lbl}>Ads Body</p>
            <p className={val}>{deal.adsBody}</p>
          </div>
        )}
      </div>
    </div>
  );
}
