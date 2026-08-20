"use client";

import { useEffect, useState, useTransition } from "react";
import { useBookingDetail } from "@/hooks/use-booking-detail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CloseCircle, FileText, Copy, Refresh, Link, DownloadMinimalistic, TrashBinTrash,
  UserRounded, CalendarMark, Wallet, UserId, Buildings, ClockCircle, Bill, Tag,
  Paperclip2, CardReceive,
} from "@solar-icons/react";
import { format } from "date-fns";
import { toast } from "sonner";
import { generateAgreementToken, markAgreementSent } from "@/actions/client-agreement";
import { deleteBookingDocument, deleteBookingDocuments } from "@/actions/booking-document";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { BookingDetail } from "@/lib/queries/bookings";

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

const lbl = "text-sm font-medium mb-0 text-muted-foreground";
const val = "text-sm font-normal text-foreground";

function fmtPrice(v: bigint | number | null | undefined): string {
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

function RichText({ html }: { html: string | null | undefined }) {
  if (!html || html === "<p></p>") return <span className="text-muted-foreground">-</span>;
  return (
    <div
      className="prose prose-sm max-w-none text-muted-foreground [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0 [&_p]:my-0 [&_strong]:text-foreground"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}


const AGREEMENT_COLOR: Record<string, string> = {
  Pending: "bg-muted text-muted-foreground",
  Sent: "bg-primary/10 text-primary",
  Viewed: "bg-muted text-foreground/70",
  Signed: "bg-primary/20 text-primary",
};

/* Status termin (derived §5) — label + warna token. */
type TermStatus = "paid" | "partial" | "overdue" | "not_due_yet";
const TERM_STATUS: Record<TermStatus, { label: string; className: string }> = {
  paid: { label: "Lunas", className: "bg-primary/15 text-primary" },
  partial: { label: "Sebagian", className: "bg-secondary text-foreground/70" },
  overdue: { label: "Jatuh tempo", className: "bg-destructive/10 text-destructive" },
  not_due_yet: { label: "Belum jatuh tempo", className: "bg-muted text-muted-foreground" },
};

/* Status verifikasi cash-in (Ledger.ackStatus). */
type AckStatus = "pending" | "acknowledged" | "rejected";
const ACK_STATUS: Record<AckStatus, { label: string; className: string }> = {
  acknowledged: { label: "Terverifikasi", className: "bg-primary text-primary-foreground" },
  pending: { label: "Menunggu", className: "bg-secondary text-muted-foreground" },
  rejected: { label: "Ditolak", className: "bg-destructive/10 text-destructive" },
};

/* Bentuk cash-in yang di-resolve route (Ledger + evidenceUrl). */
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

/* ─── Mobile section card wrapper ─────────────────────────────────────────── */

function MobileCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function MobileField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={lbl}>{label}</p>
      <div className={val}>{children}</div>
    </div>
  );
}

/* ─── Component ────────────────────────────────────────────────────────────── */

interface Props {
  open: boolean;
  onClose: () => void;
  bookingId: string | null;
}

export function BookingDetailModal({ open, onClose, bookingId }: Props) {
  const { data, isLoading: loading, refetch } = useBookingDetail(bookingId, open);
  const booking = data ?? null;
  const [activeTab, setActiveTab] = useState<"booking" | "vendor" | "payment" | "documents" | "agreement" | "bitrix">("booking");
  const [deleteDocTarget, setDeleteDocTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  useEffect(() => {
    if (!open || !bookingId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveTab("booking");
    setSelectedDocIds(new Set());
  }, [open, bookingId]);

  if (!open) return null;

  // The Client Agreement tab is only relevant once the client has actually
  // signed — before that there's nothing for the viewer to see here.
  const isAgreementSigned = booking?.clientAgreement?.status === "Signed";
  // The BITRIX tab is only relevant when this booking's customer carries a Bitrix
  // deal id (captured at create/edit when the source of information is Bitrix).
  const bitrixId = booking?.customer?.bitrixId?.trim() || null;
  const sourceOfInformationLabel = booking?.sourceOfInformation?.name
    ? booking.sourceOfInformation.name === "Bitrix" && bitrixId
      ? `${booking.sourceOfInformation.name} - ${bitrixId}`
      : booking.sourceOfInformation.name
    : "-";
  const tabs = [
    { key: "booking" as const, label: "Booking Details" },
    { key: "vendor" as const, label: "Vendor Details" },
    { key: "payment" as const, label: "Pembayaran" },
    { key: "documents" as const, label: "Dokumen" },
    ...(isAgreementSigned ? [{ key: "agreement" as const, label: "Client Agreement" }] : []),
    ...(bitrixId ? [{ key: "bitrix" as const, label: "BITRIX" }] : []),
  ];

  return (
    <div className="fixed inset-0 z-[60] flex bg-black/40 sm:items-center sm:justify-center">
      <div
        className="bg-background w-full h-full flex flex-col sm:rounded-xl sm:shadow-lg sm:w-[70%] sm:max-w-[70%] overflow-hidden sm:h-auto sm:max-h-[90vh]"
        style={{ minWidth: 0 }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex justify-between items-start px-4 sm:px-8 py-4 border-b sticky top-0 bg-background z-10">
          {loading ? (
            <Skeleton className="h-6 w-48" />
          ) : (
            <div className="flex items-center gap-2 flex-1 pr-4 min-w-0">
              {/* Mobile: truncated short title */}
              <h2 className="text-lg font-semibold truncate sm:hidden">
                {booking?.snapCustomer?.name ?? "Detail Booking"}
              </h2>
              {/* Desktop: full title */}
              <h2 className="hidden sm:block text-xl font-semibold">
                {booking ? `Daftar lengkap booking ${booking.snapCustomer?.name ?? ""}` : "Detail Booking"}
              </h2>
              {bookingId && (
                <button
                  onClick={() => { void refetch(); }}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Refresh"
                >
                  <Refresh weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          )}
          <button
            onClick={onClose}
            className="shrink-0 h-9 w-9 sm:h-11 sm:w-11 rounded-full flex items-center justify-center cursor-pointer bg-destructive/10 hover:bg-destructive/20 transition-colors"
            aria-label="Close"
          >
            <CloseCircle weight="BoldDuotone" className="h-5 w-5 sm:h-6 sm:w-6 text-destructive" />
          </button>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="flex border-b mb-0 px-4 sm:px-8 shrink-0 overflow-x-auto scrollbar-none">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-3 sm:px-6 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === t.key
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 px-4 sm:px-8 py-4 pb-20 sm:pb-4">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          ) : !booking ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Gagal memuat data booking.</div>
          ) : (
            <>
              {/* ═══ TAB: Booking Details ═══ */}
              {activeTab === "booking" && (
                <>
                  {/* ── Mobile: grouped cards ── */}
                  <div className="sm:hidden space-y-4">
                    {/* Customer */}
                    <MobileCard title="Customer" icon={<UserRounded weight="BoldDuotone" className="h-4 w-4" />}>
                      <MobileField label="Nama">
                        {booking.snapCustomer?.name ?? "-"}
                      </MobileField>
                      <MobileField label="Sales PIC">
                        {booking.sales?.fullName ?? "-"}
                      </MobileField>
                      <MobileField label="Email CPP">
                        {booking.snapCustomer?.emailCpp ?? "-"}
                      </MobileField>
                      <MobileField label="Email CPW">
                        {booking.snapCustomer?.emailCpw ?? "-"}
                      </MobileField>
                      <MobileField label="Phone Number">
                        {(() => {
                          const raw = booking.snapCustomer?.mobileNumber ?? "";
                          let nums: string[] = [];
                          try {
                            const arr = JSON.parse(raw);
                            if (Array.isArray(arr)) nums = arr.map((e: { name?: string; number: string }) => e.name ? `${e.name}: ${e.number}` : e.number);
                          } catch {
                            nums = raw.split(/[,\n]+/).map((s: string) => s.trim()).filter(Boolean);
                          }
                          if (nums.length <= 1) return <span>{nums[0] ?? "-"}</span>;
                          return <ul className="space-y-0.5">{nums.map((n, i) => <li key={i}>• {n}</li>)}</ul>;
                        })()}
                      </MobileField>
                      <MobileField label="Sumber Informasi">
                        {sourceOfInformationLabel}
                      </MobileField>
                      {booking.sourceOfInformationDetail && (
                        <MobileField label="Detail Sumber">
                          {booking.sourceOfInformationDetail}
                        </MobileField>
                      )}
                    </MobileCard>

                    {/* Event & Status */}
                    <MobileCard title="Event & Status" icon={<CalendarMark weight="BoldDuotone" className="h-4 w-4" />}>
                      <MobileField label="Event Date">
                        {fmtDate(booking.eventDate, "long")}
                      </MobileField>
                      <MobileField label="Session">
                        {booking.weddingSession ?? "-"}
                      </MobileField>
                      <MobileField label="Status Booking">
                        {booking.bookingStatus ?? "Pending"}
                      </MobileField>
                      <MobileField label="Client Agreement">
                        {booking.clientAgreement ? (
                          <Badge className={AGREEMENT_COLOR[booking.clientAgreement.status]}>{booking.clientAgreement.status}</Badge>
                        ) : (
                          <span>-</span>
                        )}
                      </MobileField>
                      {booking.bookingStatus === "Rejected" && booking.rejectionNotes && (
                        <MobileField label="Notes of Rejection">
                          <span className="text-muted-foreground">{booking.rejectionNotes}</span>
                        </MobileField>
                      )}
                    </MobileCard>

                    {/* Harga & Paket */}
                    <MobileCard title="Harga & Paket" icon={<Wallet weight="BoldDuotone" className="h-4 w-4" />}>
                      <MobileField label="Package Type">
                        {booking.snapPackage?.packageName ?? "-"}
                      </MobileField>
                      <MobileField label="Package Price">
                        {fmtPrice(booking.snapPackagePricing?.price)}
                      </MobileField>
                      <MobileField label="Package">
                        {booking.snapPackagePricing?.packageName ?? "-"}{booking.snapPackagePricing?.pax ? ` (${booking.snapPackagePricing.pax} PAX)` : ""}
                      </MobileField>
                      <MobileField label="Payment Method">
                        {booking.paymentMethod ? (
                          <div className="space-y-0.5">
                            <span className="block">{booking.paymentMethod.bankName}</span>
                            <span className="block text-xs text-muted-foreground">{booking.paymentMethod.bankAccountNumber}</span>
                            <span className="block text-xs text-muted-foreground">{booking.paymentMethod.bankRecipient}</span>
                          </div>
                        ) : (
                          <span>-</span>
                        )}
                      </MobileField>
                      <MobileField label="PO Number">
                        {booking.poNumber ?? "-"}
                      </MobileField>
                      <MobileField label="Wedding Type">
                        {booking.weddingType ?? "-"}
                      </MobileField>
                    </MobileCard>

                    {/* Identitas */}
                    <MobileCard title="Identitas (NIK & Alamat)" icon={<UserId weight="BoldDuotone" className="h-4 w-4" />}>
                      <MobileField label={`${booking.snapCustomer?.cppIdType ?? "KTP"} CPP`}>
                        {booking.snapCustomer?.cppNik ?? "-"}
                      </MobileField>
                      <MobileField label="Alamat CPP">
                        {booking.snapCustomer?.cppAddress ?? "-"}
                      </MobileField>
                      <MobileField label={`${booking.snapCustomer?.cpwIdType ?? "KTP"} CPW`}>
                        {booking.snapCustomer?.cpwNik ?? "-"}
                      </MobileField>
                      <MobileField label="Alamat CPW">
                        {booking.snapCustomer?.cpwAddress ?? "-"}
                      </MobileField>
                    </MobileCard>

                    {/* Venue & Brand */}
                    <MobileCard title="Venue & Brand" icon={<Buildings weight="BoldDuotone" className="h-4 w-4" />}>
                      <MobileField label="Venue">
                        {booking.snapVenue?.venueName ?? "-"}
                      </MobileField>
                      <MobileField label="Venue Address">
                        {booking.snapVenue?.address ?? "-"}
                      </MobileField>
                      <MobileField label="Brand">
                        {booking.snapVenue?.brandName ?? "-"}
                      </MobileField>
                      <MobileField label="Manager">
                        {booking.manager?.fullName ?? "-"}
                      </MobileField>
                    </MobileCard>

                    {/* Meta */}
                    <MobileCard title="Meta" icon={<ClockCircle weight="BoldDuotone" className="h-4 w-4" />}>
                      <MobileField label="Created At">
                        {fmtDate(booking.createdAt)}
                      </MobileField>
                      <MobileField label="Updated At">
                        {fmtDate(booking.updatedAt)}
                      </MobileField>
                    </MobileCard>
                  </div>

                  {/* ── Desktop: original 4-col grid ── */}
                  <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-4 text-sm">
                    {/* Col 1 */}
                    <div>
                      <p className={lbl}>Nama</p>
                      <p className={val}>{booking.snapCustomer?.name ?? "-"}</p>
                      <p className={lbl + " mt-4"}>Sales PIC</p>
                      <p className={val}>{booking.sales?.fullName ?? "-"}</p>
                      <p className={lbl + " mt-4"}>Email CPP</p>
                      <p className={val}>{booking.snapCustomer?.emailCpp ?? "-"}</p>
                      <p className={lbl + " mt-4"}>Email CPW</p>
                      <p className={val}>{booking.snapCustomer?.emailCpw ?? "-"}</p>
                      <p className={lbl + " mt-4"}>Phone Number</p>
                      {(() => {
                        const raw = booking.snapCustomer?.mobileNumber ?? "";
                        let nums: string[] = [];
                        try {
                          const arr = JSON.parse(raw);
                          if (Array.isArray(arr)) nums = arr.map((e: { name?: string; number: string }) => e.name ? `${e.name}: ${e.number}` : e.number);
                        } catch {
                          nums = raw.split(/[,\n]+/).map((s: string) => s.trim()).filter(Boolean);
                        }
                        if (nums.length <= 1) return <p className={val}>{nums[0] ?? "-"}</p>;
                        return <ul className="mt-1 space-y-0.5">{nums.map((n, i) => <li key={i} className={val}>• {n}</li>)}</ul>;
                      })()}
                      <p className={lbl + " mt-4"}>Venue</p>
                      <p className={val}>{booking.snapVenue?.venueName ?? "-"}</p>
                      <p className={lbl + " mt-4"}>Package Type</p>
                      <p className={val}>{booking.snapPackage?.packageName ?? "-"}</p>
                      <p className={lbl + " mt-4"}>Sumber Informasi</p>
                      <p className={val}>{sourceOfInformationLabel}</p>
                      {booking.sourceOfInformationDetail && (
                        <>
                          <p className={lbl + " mt-4"}>Detail Sumber</p>
                          <p className={val}>{booking.sourceOfInformationDetail}</p>
                        </>
                      )}
                    </div>
                    {/* Col 2 */}
                    <div>
                      <p className={lbl}>Event Date</p>
                      <p className={val}>{fmtDate(booking.eventDate, "long")}</p>
                      <p className={lbl + " mt-4"}>Session</p>
                      <p className={val}>{booking.weddingSession ?? "-"}</p>
                      <p className={lbl + " mt-4"}>Status Booking</p>
                      <p className={val}>{booking.bookingStatus ?? "Pending"}</p>
                      <p className={lbl + " mt-4"}>Payment Method</p>
                      {booking.paymentMethod ? (
                        <div className="space-y-0.5">
                          <p className={val}>{booking.paymentMethod.bankName}</p>
                          <p className="text-xs text-muted-foreground">{booking.paymentMethod.bankAccountNumber}</p>
                          <p className="text-xs text-muted-foreground">{booking.paymentMethod.bankRecipient}</p>
                        </div>
                      ) : (
                        <p className={val}>-</p>
                      )}
                      <p className={lbl + " mt-4"}>Package Price</p>
                      <p className={val}>{fmtPrice(booking.snapPackagePricing?.price)}</p>
                      <p className={lbl + " mt-4"}>Package</p>
                      <p className={val}>{booking.snapPackagePricing?.packageName ?? "-"}{booking.snapPackagePricing?.pax ? ` (${booking.snapPackagePricing.pax} PAX)` : ""}</p>
                      <p className={lbl + " mt-4"}>Manager</p>
                      <p className={val}>{booking.manager?.fullName ?? "-"}</p>
                    </div>
                    {/* Col 3 */}
                    <div>
                      <p className={lbl}>PO Number</p>
                      <p className={val}>{booking.poNumber ?? "-"}</p>
                      <p className={lbl + " mt-4"}>Wedding Type</p>
                      <p className={val}>{booking.weddingType ?? "-"}</p>
                      <p className={lbl + " mt-4"}>{`${booking.snapCustomer?.cppIdType ?? "KTP"} CPP`}</p>
                      <p className={val}>{booking.snapCustomer?.cppNik ?? "-"}</p>
                      <p className={lbl + " mt-4"}>Alamat CPP</p>
                      <p className={val}>{booking.snapCustomer?.cppAddress ?? "-"}</p>
                      <p className={lbl + " mt-4"}>{`${booking.snapCustomer?.cpwIdType ?? "KTP"} CPW`}</p>
                      <p className={val}>{booking.snapCustomer?.cpwNik ?? "-"}</p>
                      <p className={lbl + " mt-4"}>Alamat CPW</p>
                      <p className={val}>{booking.snapCustomer?.cpwAddress ?? "-"}</p>
                      <p className={lbl + " mt-4"}>Created At</p>
                      <p className={val}>{fmtDate(booking.createdAt)}</p>
                      <p className={lbl + " mt-4"}>Updated At</p>
                      <p className={val}>{fmtDate(booking.updatedAt)}</p>
                    </div>
                    {/* Col 4 */}
                    <div>
                      <p className={lbl}>Client Agreement</p>
                      {booking.clientAgreement ? (
                        <Badge className={AGREEMENT_COLOR[booking.clientAgreement.status]}>{booking.clientAgreement.status}</Badge>
                      ) : (
                        <p className={val}>-</p>
                      )}
                      {booking.bookingStatus === "Rejected" && booking.rejectionNotes && (
                        <>
                          <p className={lbl + " mt-4"}>Notes of rejection</p>
                          <p className="text-muted-foreground text-sm font-normal">{booking.rejectionNotes}</p>
                        </>
                      )}
                      <p className={lbl + " mt-4"}>Venue Address</p>
                      <p className={val}>{booking.snapVenue?.address ?? "-"}</p>
                      <p className={lbl + " mt-4"}>Brand</p>
                      <p className={val}>{booking.snapVenue?.brandName ?? "-"}</p>
                    </div>
                  </div>
                </>
              )}

              {/* ═══ TAB: Vendor Details ═══ */}
              {activeTab === "vendor" && (
                <div className="space-y-6">
                  {/* Vendor + Bonus section */}
                  {(booking.snapVendorItems.length > 0 || booking.snapBonuses.length > 0) && (
                    <>
                      {/* Mobile: card per vendor row */}
                      <div className="sm:hidden space-y-3">
                        {booking.snapVendorItems.filter((v) => !v.isAddons).map((v) => (
                          <div key={v.id} className="rounded-2xl border bg-card p-4 space-y-2">
                            <div className="flex items-center gap-2">
                              <Tag weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
                              <p className="text-sm font-semibold text-foreground">{v.vendorCategoryName}</p>
                            </div>
                            <div className="space-y-1.5 text-sm">
                              <div>
                                <p className={lbl}>Nama Vendor</p>
                                <p className={val}>{v.vendorName}</p>
                              </div>
                              <div>
                                <p className={lbl}>Nominal</p>
                                <p className={val}>{Number(v.itemPrice) > 0 ? fmtPrice(v.itemPrice) : "-"}</p>
                              </div>
                              <div>
                                <p className={lbl}>Keterangan</p>
                                <RichText html={v.description} />
                              </div>
                              <div>
                                <p className={lbl}>Status Order</p>
                                <p className={val}>{(v as typeof v & { orderStatus?: { name: string } | null }).orderStatus?.name ?? "-"}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                        {booking.snapBonuses.length > 0 && (
                          <>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 pt-2">Complimentary / Bonus</p>
                            {booking.snapBonuses.map((b) => (
                              <div key={b.id} className="rounded-2xl border bg-card p-4 space-y-2">
                                <div className="flex items-center gap-2">
                                  <Tag weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <p className="text-sm font-semibold text-foreground">Complimentary</p>
                                </div>
                                <div className="space-y-1.5 text-sm">
                                  <div>
                                    <p className={lbl}>Nama Vendor</p>
                                    <p className={val}>{b.vendorName}</p>
                                  </div>
                                  <div>
                                    <p className={lbl}>Nominal</p>
                                    <p className={val}>{Number((b as typeof b & { nominal?: number | null }).nominal ?? 0) > 0 ? `Rp ${new Intl.NumberFormat("id-ID").format(Number((b as typeof b & { nominal?: number | null }).nominal))}` : "-"}</p>
                                  </div>
                                  <div>
                                    <p className={lbl}>Keterangan</p>
                                    <RichText html={b.description} />
                                  </div>
                                  <div>
                                    <p className={lbl}>Status Order</p>
                                    <p className={val}>{b.orderStatus?.name ?? "-"}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>

                      {/* Desktop: original table */}
                      <div className="hidden sm:block rounded-md border overflow-hidden [&_[data-slot=table-container]]:overflow-hidden">
                        <Table className="table-fixed w-full">
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="px-4 w-[18%]">Kategori</TableHead>
                              <TableHead className="px-4 w-[20%]">Nama Vendor</TableHead>
                              <TableHead className="px-4 w-[15%]">Nominal</TableHead>
                              <TableHead className="px-4 w-[32%]">Keterangan</TableHead>
                              <TableHead className="px-4 w-[15%]">Status Order</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {booking.snapVendorItems.filter((v) => !v.isAddons).map((v) => (
                              <TableRow key={v.id}>
                                <TableCell className="px-4 font-medium text-sm text-foreground whitespace-normal break-words">{v.vendorCategoryName}</TableCell>
                                <TableCell className="px-4 text-sm whitespace-normal break-words">{v.vendorName}</TableCell>
                                <TableCell className="px-4 text-sm whitespace-normal">{Number(v.itemPrice) > 0 ? fmtPrice(v.itemPrice) : "-"}</TableCell>
                                <TableCell className="px-4 text-sm whitespace-normal break-words"><RichText html={v.description} /></TableCell>
                                <TableCell className="px-4 text-sm text-muted-foreground whitespace-normal break-words">{(v as typeof v & { orderStatus?: { name: string } | null }).orderStatus?.name ?? "-"}</TableCell>
                              </TableRow>
                            ))}
                            {booking.snapBonuses.length > 0 && (
                              <TableRow className="bg-muted/50">
                                <TableCell colSpan={5} className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-normal">Complimentary / Bonus</TableCell>
                              </TableRow>
                            )}
                            {booking.snapBonuses.map((b) => (
                              <TableRow key={b.id}>
                                <TableCell className="px-4 font-medium text-sm text-foreground whitespace-normal break-words">Complimentary</TableCell>
                                <TableCell className="px-4 text-sm whitespace-normal break-words">{b.vendorName}</TableCell>
                                <TableCell className="px-4 text-sm whitespace-normal">{Number((b as typeof b & { nominal?: number | null }).nominal ?? 0) > 0 ? `Rp ${new Intl.NumberFormat("id-ID").format(Number((b as typeof b & { nominal?: number | null }).nominal))}` : "-"}</TableCell>
                                <TableCell className="px-4 text-sm whitespace-normal break-words"><RichText html={b.description} /></TableCell>
                                <TableCell className="px-4 text-sm text-muted-foreground whitespace-normal break-words">{b.orderStatus?.name ?? "-"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}

                  {/* Internal items */}
                  {booking.snapPackageInternalItems.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Internal Items</p>
                      {/* Mobile: card per item */}
                      <div className="sm:hidden space-y-3">
                        {booking.snapPackageInternalItems.map((item) => (
                          <div key={item.id} className="rounded-2xl border bg-card p-4 space-y-1.5">
                            <p className="text-sm font-semibold text-foreground">{item.itemName}</p>
                            {item.itemDescription && <RichText html={item.itemDescription} />}
                          </div>
                        ))}
                      </div>
                      {/* Desktop: table */}
                      <div className="hidden sm:block rounded-md border overflow-hidden [&_[data-slot=table-container]]:overflow-hidden">
                        <Table className="table-fixed w-full">
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="px-4 w-[35%]">Nama Item</TableHead>
                              <TableHead className="px-4">Keterangan</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {booking.snapPackageInternalItems.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="px-4 font-medium text-sm text-foreground align-top whitespace-normal break-words">{item.itemName}</TableCell>
                                <TableCell className="px-4 text-sm whitespace-normal break-words">{item.itemDescription ? <RichText html={item.itemDescription} /> : <span className="text-muted-foreground">—</span>}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Package vendor items */}
                  {booking.snapPackageVendorItems.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Paket Vendor Items</p>
                      {/* Mobile: card per item */}
                      <div className="sm:hidden space-y-3">
                        {booking.snapPackageVendorItems.map((item) => (
                          <div key={item.id} className="rounded-2xl border bg-card p-4 space-y-1.5">
                            <p className="text-sm font-semibold text-foreground">{item.categoryName}</p>
                            <RichText html={item.itemText} />
                          </div>
                        ))}
                      </div>
                      {/* Desktop: table */}
                      <div className="hidden sm:block rounded-md border overflow-hidden [&_[data-slot=table-container]]:overflow-hidden">
                        <Table className="table-fixed w-full">
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="px-4 w-[35%]">Kategori</TableHead>
                              <TableHead className="px-4">Item</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {booking.snapPackageVendorItems.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="px-4 font-medium text-sm text-foreground align-top whitespace-normal break-words">{item.categoryName}</TableCell>
                                <TableCell className="px-4 text-sm whitespace-normal break-words"><RichText html={item.itemText} /></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* New-style complimentaries */}
                  {(booking as typeof booking & { snapComplimentaries?: { id: string; name: string; price: number; isShowPrice: boolean; qty: number; description?: string | null }[] }).snapComplimentaries && (booking as typeof booking & { snapComplimentaries?: { id: string; name: string; price: number; isShowPrice: boolean; qty: number; description?: string | null }[] }).snapComplimentaries!.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Complimentary</p>
                      {/* Mobile */}
                      <div className="sm:hidden space-y-3">
                        {(booking as typeof booking & { snapComplimentaries: { id: string; name: string; price: number; isShowPrice: boolean; qty: number; description?: string | null }[] }).snapComplimentaries.map((c) => (
                          <div key={c.id} className="rounded-2xl border bg-card p-4 space-y-2">
                            <div className="flex items-center gap-2">
                              <Tag weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
                              <p className="text-sm font-semibold text-foreground">{c.name}</p>
                            </div>
                            <div className="space-y-1.5 text-sm">
                              <div><p className={lbl}>Qty</p><p className={val}>{c.qty}</p></div>
                              <div><p className={lbl}>Harga</p><p className={val}>{c.isShowPrice ? fmtPrice(c.price) : "(Tersembunyi)"}</p></div>
                              {c.description && <div><p className={lbl}>Keterangan</p><RichText html={c.description} /></div>}
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Desktop */}
                      <div className="hidden sm:block rounded-md border overflow-hidden [&_[data-slot=table-container]]:overflow-hidden">
                        <Table className="table-fixed w-full">
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="px-4">Nama</TableHead>
                              <TableHead className="px-4 w-20">Qty</TableHead>
                              <TableHead className="px-4 w-37.5">Harga</TableHead>
                              <TableHead className="px-4">Keterangan</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(booking as typeof booking & { snapComplimentaries: { id: string; name: string; price: number; isShowPrice: boolean; qty: number; description?: string | null }[] }).snapComplimentaries.map((c) => (
                              <TableRow key={c.id}>
                                <TableCell className="px-4 font-medium text-sm text-foreground whitespace-normal break-words">{c.name}</TableCell>
                                <TableCell className="px-4 text-sm whitespace-normal">{c.qty}</TableCell>
                                <TableCell className="px-4 text-sm whitespace-normal">{c.isShowPrice ? fmtPrice(c.price) : <span className="text-muted-foreground">(Tersembunyi)</span>}</TableCell>
                                <TableCell className="px-4 text-sm whitespace-normal break-words"><RichText html={c.description} /></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {booking.snapVendorItems.length === 0 && booking.snapBonuses.length === 0 && booking.snapPackageInternalItems.length === 0 && booking.snapPackageVendorItems.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <FileText className="h-10 w-10 text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">Belum ada data vendor.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ═══ TAB: Pembayaran ═══ */}
              {activeTab === "payment" && <PaymentSection booking={booking} />}

              {/* ═══ TAB: Dokumen ═══ */}
              {activeTab === "documents" && (
                <div className="space-y-6">
                  {booking.bookingDocuments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <FileText className="h-10 w-10 text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">Belum ada dokumen.</p>
                      <p className="text-xs text-muted-foreground mt-1">Upload dokumen melalui tombol di action table.</p>
                    </div>
                  ) : (
                    (() => {
                      const grouped: Record<string, typeof booking.bookingDocuments> = {};
                      booking.bookingDocuments.forEach((doc) => {
                        if (!grouped[doc.name]) grouped[doc.name] = [];
                        grouped[doc.name].push(doc);
                      });
                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {Object.entries(grouped).map(([docName, docs]) => {
                            const groupIds = docs.map((d) => d.id);
                            const allSelected = groupIds.every((id) => selectedDocIds.has(id));
                            const toggleGroup = () => {
                              setSelectedDocIds((prev) => {
                                const next = new Set(prev);
                                if (allSelected) { groupIds.forEach((id) => next.delete(id)); }
                                else { groupIds.forEach((id) => next.add(id)); }
                                return next;
                              });
                            };
                            return (
                              <div key={docName} className="border rounded-lg p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-medium text-foreground truncate">{docName}</p>
                                  <button type="button" onClick={toggleGroup} className="text-[10px] text-muted-foreground hover:text-foreground shrink-0">
                                    {allSelected ? "Deselect all" : "Select all"}
                                  </button>
                                </div>
                                {docs[0]?.description && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5">{docs[0].description}</p>
                                )}
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {docs.map((doc) => {
                                    const url = (doc as typeof doc & { fileUrl?: string }).fileUrl ?? "";
                                    const isImage = doc.fileType?.startsWith("image/");
                                    const ext = doc.fileName?.split(".").pop() ?? "FILE";
                                    const isSelected = selectedDocIds.has(doc.id);
                                    return (
                                      <div key={doc.id} className={`w-25 border rounded-lg overflow-hidden bg-card transition-colors ${isSelected ? "border-primary ring-1 ring-primary" : "border-border"}`}>
                                        <div className="relative">
                                          <div
                                            className="h-20 w-full bg-muted/50 flex items-center justify-center overflow-hidden cursor-pointer"
                                            onClick={() => { if (url) window.open(url, "_blank", "noopener,noreferrer"); }}
                                          >
                                            {isImage && url ? (
                                              // eslint-disable-next-line @next/next/no-img-element
                                              <img src={url} alt={doc.fileName} className="w-full h-full object-cover" />
                                            ) : (
                                              <div className="flex flex-col items-center gap-1">
                                                <FileText className="h-6 w-6 text-muted-foreground" />
                                                <span className="text-[9px] text-muted-foreground uppercase font-medium">{ext}</span>
                                              </div>
                                            )}
                                          </div>
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => setSelectedDocIds((prev) => {
                                              const next = new Set(prev);
                                              if (isSelected) { next.delete(doc.id); } else { next.add(doc.id); }
                                              return next;
                                            })}
                                            onClick={(e) => e.stopPropagation()}
                                            className="absolute top-1.5 left-1.5 h-3.5 w-3.5 cursor-pointer accent-foreground"
                                          />
                                        </div>
                                        <div className="px-1.5 py-1">
                                          <div className="flex items-center justify-between gap-0.5">
                                            <p className="text-[10px] text-foreground truncate flex-1">{doc.fileName}</p>
                                            <div className="flex items-center gap-0.5 shrink-0">
                                              <button
                                                type="button"
                                                className="shrink-0 text-muted-foreground hover:text-foreground"
                                                onClick={async (e) => {
                                                  e.stopPropagation();
                                                  try {
                                                    const res = await fetch(url);
                                                    const blob = await res.blob();
                                                    const a = document.createElement("a");
                                                    a.href = URL.createObjectURL(blob);
                                                    a.download = doc.fileName;
                                                    a.click();
                                                    URL.revokeObjectURL(a.href);
                                                  } catch {
                                                    window.open(url, "_blank", "noopener,noreferrer");
                                                  }
                                                }}
                                              >
                                                <DownloadMinimalistic weight="BoldDuotone" className="h-2.5 w-2.5" />
                                              </button>
                                              <button
                                                type="button"
                                                className="shrink-0 text-muted-foreground hover:text-destructive"
                                                onClick={(e) => { e.stopPropagation(); setDeleteDocTarget({ id: doc.id, name: doc.fileName }); }}
                                              >
                                                <TrashBinTrash weight="BoldDuotone" className="h-2.5 w-2.5 text-muted-foreground" />
                                              </button>
                                            </div>
                                          </div>
                                          <p className="text-[9px] text-muted-foreground">
                                            {doc.fileSize < 1024 * 1024
                                              ? `${(doc.fileSize / 1024).toFixed(1)} KB`
                                              : `${(doc.fileSize / (1024 * 1024)).toFixed(1)} MB`}
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()
                  )}

                  {/* Bulk action bar */}
                  {selectedDocIds.size > 0 && (
                    <div className="sticky bottom-0 bg-background border-t pt-3 pb-1 flex items-center justify-between gap-3">
                      <span className="text-sm text-muted-foreground">{selectedDocIds.size} file dipilih</span>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setSelectedDocIds(new Set())} className="text-sm text-muted-foreground hover:text-foreground">Batal</button>
                        <button type="button" onClick={() => setShowBulkConfirm(true)} className="text-sm text-destructive hover:text-destructive/80 font-medium">Hapus {selectedDocIds.size} file</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ═══ TAB: Client Agreement ═══ */}
              {activeTab === "agreement" && (
                <ClientAgreementSection booking={booking} />
              )}

              {/* ═══ TAB: BITRIX ═══ */}
              {activeTab === "bitrix" && bitrixId && (
                <BitrixSection key={bitrixId} dealId={bitrixId} />
              )}
            </>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={!!deleteDocTarget}
        onOpenChange={(v) => { if (!v) setDeleteDocTarget(null); }}
        title="Hapus Dokumen"
        description={`Yakin mau hapus "${deleteDocTarget?.name}"? File akan dihapus permanen.`}
        confirmLabel={deleting ? "Menghapus..." : "Hapus"}
        destructive
        zIndex={70}
        onConfirm={async () => {
          if (!deleteDocTarget) return;
          setDeleting(true);
          const result = await deleteBookingDocument(deleteDocTarget.id);
          setDeleting(false);
          if (!result.success) { toast.error(result.error); return; }
          toast.success("Dokumen berhasil dihapus");
          setDeleteDocTarget(null);
          void refetch();
        }}
      />
      <ConfirmDialog
        open={showBulkConfirm}
        onOpenChange={(v) => { if (!v) setShowBulkConfirm(false); }}
        title="Hapus Dokumen"
        description={`Yakin mau hapus ${selectedDocIds.size} file? Semua file akan dihapus permanen.`}
        confirmLabel={bulkDeleting ? "Menghapus..." : `Hapus ${selectedDocIds.size} file`}
        destructive
        zIndex={70}
        onConfirm={async () => {
          setBulkDeleting(true);
          const result = await deleteBookingDocuments([...selectedDocIds]);
          setBulkDeleting(false);
          if (!result.success) { toast.error(result.error); return; }
          toast.success(`${result.count} file berhasil dihapus`);
          setShowBulkConfirm(false);
          setSelectedDocIds(new Set());
          void refetch();
        }}
      />
    </div>
  );
}

/* ─── Bitrix Sub-component ─────────────────────────────────────────────────── */

// Enriched deal shape returned by GET /api/bitrix/deals (subset consumed here).
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
  process: "bg-blue-50 text-blue-600",
};

function BitrixField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={lbl}>{label}</p>
      <p className={val}>{children}</p>
    </div>
  );
}

/** Fetches and renders the linked Bitrix24 deal for a booking's customer. The
 *  deal id comes from Customer.bitrixId (set when the source is Bitrix). Reuses
 *  the existing enriched /api/bitrix/deals route filtered by ID. */
function BitrixSection({ dealId }: { dealId: string }) {
  const [deal, setDeal] = useState<BitrixDeal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/bitrix/deals?filter[ID]=${encodeURIComponent(dealId)}`)
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as
          | { items?: BitrixDeal[]; error?: string }
          | null;
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
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
      <div className="rounded-2xl border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <p className="mt-1 text-xs text-muted-foreground">Bitrix ID: {dealId}</p>
      </div>
    );
  }

  if (!deal) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-foreground">{deal.title}</h3>
        <Badge className={BITRIX_SEMANTIC_STYLE[deal.stageSemantic]}>{deal.stage}</Badge>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
        <BitrixField label="Deal ID">{deal.id}</BitrixField>
        <BitrixField label="Pipeline">{deal.pipeline}</BitrixField>
        <BitrixField label="Stage">{deal.stage}</BitrixField>
        <BitrixField label="Client">{deal.client ?? "-"}</BitrixField>
        <BitrixField label="Phone">{deal.phone ?? "-"}</BitrixField>
        <BitrixField label="Nilai (Opportunity)">
          {deal.opportunity ? `${fmtPrice(deal.opportunity)}` : "-"}
        </BitrixField>
        <BitrixField label="Source">
          <span>{deal.source}</span>
          {deal.adsUrl && (
            <a
              href={deal.adsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 flex items-center gap-1 text-blue-600 hover:underline break-all"
            >
              <Link weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0" />
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

/* ─── Payment Sub-component ────────────────────────────────────────────────── */

function PaymentSection({ booking }: { booking: BookingDetail }) {
  // termStatuses & cashIns di-resolve server-side di GET /api/bookings/[id] tapi
  // BUKAN bagian dari tipe BookingDetail — dibaca lewat cast inline (pola sama
  // dengan fileUrl / snapComplimentaries di file ini).
  const termStatuses =
    (booking as typeof booking & { termStatuses?: Record<string, TermStatus> }).termStatuses ?? {};
  const cashIns =
    (booking as typeof booking & { cashIns?: CashInView[] }).cashIns ?? [];

  return (
    <div className="space-y-6 text-sm">
      <div className="flex items-center gap-2">
        <p className={lbl}>Metode Pembayaran:</p>
        <p className={val}>
          {booking.paymentMethod?.bankName ?? "-"}
          {booking.paymentMethod?.bankAccountNumber ? ` (${booking.paymentMethod.bankAccountNumber})` : ""}
        </p>
      </div>

      {/* ── Jadwal termin + status ── */}
      {booking.termOfPayments.length === 0 ? (
        <p className="text-muted-foreground text-sm">Belum ada jadwal pembayaran.</p>
      ) : (
        <>
          {/* Mobile: card per termin */}
          <div className="sm:hidden space-y-3">
            {booking.termOfPayments.map((t, i) => {
              const st = TERM_STATUS[termStatuses[t.id] ?? "not_due_yet"];
              return (
                <div key={t.id} className="rounded-2xl border bg-card p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Bill weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
                      <p className="text-sm font-semibold text-foreground truncate">{t.name || `Termin ${i + 1}`}</p>
                    </div>
                    <Badge className={`shrink-0 ${st.className}`}>{st.label}</Badge>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div>
                      <p className={lbl}>Nominal</p>
                      <p className={val}>{fmtPrice(t.amount)}</p>
                    </div>
                    <div>
                      <p className={lbl}>Jatuh Tempo</p>
                      <p className={val}>{fmtDate(t.dueDate, "long")}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Termin</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nominal</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Jatuh Tempo</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {booking.termOfPayments.map((t, i) => {
                  const st = TERM_STATUS[termStatuses[t.id] ?? "not_due_yet"];
                  return (
                    <tr key={t.id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium text-foreground">{t.name || `Termin ${i + 1}`}</td>
                      <td className="px-4 py-3 text-foreground">{fmtPrice(t.amount)}</td>
                      <td className="px-4 py-3 text-foreground">{fmtDate(t.dueDate, "long")}</td>
                      <td className="px-4 py-3">
                        <Badge className={st.className}>{st.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Riwayat pembayaran (cash-in Ledger) ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CardReceive weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Riwayat Pembayaran</p>
        </div>

        {cashIns.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-muted/20 p-6 text-center">
            <p className="text-sm text-muted-foreground">Belum ada pembayaran tercatat.</p>
          </div>
        ) : (
          <>
            {/* Mobile: card per pembayaran (biar tetap kebaca di layar sempit) */}
            <div className="sm:hidden space-y-3">
              {cashIns.map((ci) => {
                const ack = ACK_STATUS[ci.ackStatus] ?? ACK_STATUS.pending;
                return (
                  <div key={ci.id} className="rounded-2xl border bg-card p-4 space-y-2 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-base font-heading font-semibold tabular-nums text-foreground">{fmtPrice(ci.amount)}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(ci.occurredAt, "long")}</p>
                      </div>
                      <Badge className={`shrink-0 ${ack.className}`}>{ack.label}</Badge>
                    </div>

                    {ci.linkedTermNames.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {ci.linkedTermNames.map((name, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center rounded-full bg-secondary/60 px-2 py-0.5 text-[11px] text-foreground/70"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    )}

                    {ci.invoiceNumber && (
                      <p className="text-xs text-muted-foreground">
                        No. Kwitansi: <span className="font-mono text-foreground">{ci.invoiceNumber}</span>
                      </p>
                    )}
                    {ci.notes && <p className="text-xs text-muted-foreground">{ci.notes}</p>}

                    <div className="border-t pt-2">
                      {ci.evidenceUrl ? (
                        <a
                          href={ci.evidenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
                        >
                          <Paperclip2 weight="BoldDuotone" className="h-3.5 w-3.5" />
                          Lihat bukti
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">Tanpa bukti</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: table — sibling dari tabel termin di atasnya (header & ritme sama) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tanggal</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nominal</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Termin</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Bukti</th>
                  </tr>
                </thead>
                <tbody>
                  {cashIns.map((ci) => {
                    const ack = ACK_STATUS[ci.ackStatus] ?? ACK_STATUS.pending;
                    return (
                      <tr key={ci.id} className="border-b align-top hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <p className="text-foreground">{fmtDate(ci.occurredAt, "long")}</p>
                          {ci.invoiceNumber && (
                            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{ci.invoiceNumber}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium tabular-nums text-foreground">{fmtPrice(ci.amount)}</td>
                        <td className="px-4 py-3">
                          {ci.linkedTermNames.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {ci.linkedTermNames.map((name, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center rounded-full bg-secondary/60 px-2 py-0.5 text-[11px] text-foreground/70"
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                          {ci.notes && <p className="mt-1 text-xs text-muted-foreground">{ci.notes}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={ack.className}>{ack.label}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          {ci.evidenceUrl ? (
                            <a
                              href={ci.evidenceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                            >
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
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Client Agreement Sub-component ───────────────────────────────────────── */

function ClientAgreementSection({ booking }: { booking: BookingDetail }) {
  const [agreement, setAgreement] = useState(booking.clientAgreement);
  const [isPending, startTransition] = useTransition();
  const clientSignature = booking.clientSignature ?? null;

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const agreementUrl = agreement ? `${baseUrl}/client-agreement?token=${agreement.token}` : null;

  const handleGenerate = () => {
    startTransition(async () => {
      const result = await generateAgreementToken(booking.id);
      if (!result.success) { toast.error(result.error); return; }
      setAgreement(result.agreement);
      toast.success("Link agreement berhasil di-generate");
    });
  };

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Client Agreement</p>
        {agreement && <Badge className={AGREEMENT_COLOR[agreement.status]}>{agreement.status}</Badge>}
      </div>
      {!agreement ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <Link weight="BoldDuotone" className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Belum ada link agreement.</p>
          <Button onClick={handleGenerate} disabled={isPending} size="sm">
            {isPending ? "Generating..." : "Generate Link"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Link Agreement</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted/50 border rounded px-3 py-2 truncate">{agreementUrl}</code>
              <Button variant="outline" size="sm" disabled={isPending} onClick={() => { navigator.clipboard.writeText(agreementUrl!); toast.success("Link disalin"); }}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Kode Akses</p>
            <div className="flex items-center gap-2">
              <code className="text-lg font-mono font-bold tracking-widest bg-muted/50 border rounded px-3 py-2">{agreement.accessCode}</code>
              <Button variant="outline" size="sm" disabled={isPending} onClick={() => { navigator.clipboard.writeText(agreement!.accessCode); toast.success("Kode disalin"); }}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5">
            {agreement.sentAt && <p>Dikirim: {fmtDateTime(agreement.sentAt)}</p>}
            {agreement.viewedAt && <p>Dilihat: {fmtDateTime(agreement.viewedAt)}</p>}
            {agreement.signedAt && <p>Ditandatangani: {fmtDateTime(agreement.signedAt)}</p>}
          </div>
          {agreement.status === "Signed" && clientSignature && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Tanda Tangan Client</p>
              <div className="border rounded-lg p-2 bg-card w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={clientSignature}
                  alt="Tanda tangan client"
                  className="max-h-24 max-w-48 object-contain"
                />
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            {agreement.status === "Pending" && (
              <Button variant="outline" size="sm" onClick={() => {
                startTransition(async () => {
                  const r = await markAgreementSent(booking.id);
                  if (!r.success) { toast.error(r.error); return; }
                  setAgreement((prev) => prev ? { ...prev, status: "Sent", sentAt: new Date() } : prev);
                  toast.success("Status diupdate ke Sent");
                });
              }} disabled={isPending}>Tandai Sudah Dikirim</Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
