"use client";

import { useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CloseCircle, FileText, Copy, Refresh, Link, DownloadMinimalistic, TrashBinTrash } from "@solar-icons/react";
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

/* ─── Component ────────────────────────────────────────────────────────────── */

interface Props {
  open: boolean;
  onClose: () => void;
  bookingId: string | null;
}

export function BookingDetailModal({ open, onClose, bookingId }: Props) {
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"booking" | "vendor" | "payment" | "documents" | "agreement">("booking");
  const [deleteDocTarget, setDeleteDocTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  const fetchBooking = (id: string) => {
    setLoading(true);
    fetch(`/api/bookings/${id}`)
      .then((r) => r.json())
      .then((data: BookingDetail) => setBooking(data))
      .catch(() => setBooking(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open || !bookingId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveTab("booking");
    setSelectedDocIds(new Set());
    fetchBooking(bookingId);
  }, [open, bookingId]);

  if (!open) return null;

  const tabs = [
    { key: "booking" as const, label: "Booking Details" },
    { key: "vendor" as const, label: "Vendor Details" },
    { key: "payment" as const, label: "Pembayaran" },
    { key: "documents" as const, label: "Dokumen" },
    { key: "agreement" as const, label: "Client Agreement" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex sm:items-center sm:justify-center sm:bg-black/40">
      <div
        className="bg-background w-full h-full flex flex-col sm:rounded-xl sm:shadow-lg sm:w-[70%] sm:max-w-[70%] overflow-hidden sm:h-auto sm:max-h-[90vh]"
        style={{ minWidth: 0 }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex justify-between items-start px-4 sm:px-8 py-4 border-b sticky top-0 bg-background z-10">
          {loading ? (
            <Skeleton className="h-6 w-48" />
          ) : (
            <div className="flex items-center gap-2 flex-1 pr-4">
              <h2 className="text-lg sm:text-xl font-semibold">
                {booking ? `Daftar lengkap booking ${booking.snapCustomer?.name ?? ""}` : "Detail Booking"}
              </h2>
              {bookingId && (
                <button
                  onClick={() => fetchBooking(bookingId)}
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
            className="shrink-0 h-11 w-11 rounded-full flex items-center justify-center cursor-pointer bg-destructive/10 hover:bg-destructive/20 transition-colors"
            aria-label="Close"
          >
            <CloseCircle weight="BoldDuotone" className="h-6 w-6 text-destructive" />
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
        <div className="overflow-y-auto flex-1 px-4 sm:px-8 py-4">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-4 text-sm">
                  {/* Col 1 */}
                  <div>
                    <p className={lbl}>Nama</p>
                    <p className={val}>{booking.snapCustomer?.name ?? "-"}</p>
                    <p className={lbl + " mt-4"}>Sales PIC</p>
                    <p className={val}>{booking.sales?.fullName ?? "-"}</p>
                    <p className={lbl + " mt-4"}>Email</p>
                    <p className={val}>{booking.snapCustomer?.email ?? "-"}</p>
                    <p className={lbl + " mt-4"}>Phone Number</p>
                    {(() => {
                      const raw = booking.snapCustomer?.mobileNumber ?? "";
                      let nums: string[] = []; try { const arr = JSON.parse(raw); if (Array.isArray(arr)) nums = arr.map((e: { name?: string; number: string }) => e.name ? `${e.name}: ${e.number}` : e.number); } catch { nums = raw.split(/[,\n]+/).map((s: string) => s.trim()).filter(Boolean); }
                      if (nums.length <= 1) return <p className={val}>{nums[0] ?? "-"}</p>;
                      return <ul className="mt-1 space-y-0.5">{nums.map((n, i) => <li key={i} className={val}>• {n}</li>)}</ul>;
                    })()}
                    <p className={lbl + " mt-4"}>Venue</p>
                    <p className={val}>{booking.snapVenue?.venueName ?? "-"}</p>
                    <p className={lbl + " mt-4"}>Package Type</p>
                    <p className={val}>{booking.snapPackage?.packageName ?? "-"}</p>
                    <p className={lbl + " mt-4"}>Sumber Informasi</p>
                    <p className={val}>{booking.sourceOfInformation?.name ?? "-"}</p>
                  </div>
                  {/* Col 2 */}
                  <div>
                    <p className={lbl}>Event Date</p>
                    <p className={val}>{fmtDate(booking.bookingDate, "long")}</p>
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
                    <p className={val}>{booking.snapPackagePricing?.packageName ?? "-"} ({booking.snapPackagePricing?.pax ?? 0} PAX)</p>
                    <p className={lbl + " mt-4"}>Manager</p>
                    <p className={val}>{booking.manager?.fullName ?? "-"}</p>
                  </div>
                  {/* Col 3 */}
                  <div>
                    <p className={lbl}>PO Number</p>
                    <p className={val}>{booking.poNumber ?? "-"}</p>
                    <p className={lbl + " mt-4"}>Wedding Type</p>
                    <p className={val}>{booking.weddingType ?? "-"}</p>
                    <p className={lbl + " mt-4"}>NIK CPP</p>
                    <p className={val}>{booking.snapCustomer?.cppNik ?? "-"}</p>
                    <p className={lbl + " mt-4"}>Alamat CPP</p>
                    <p className={val}>{booking.snapCustomer?.cppAddress ?? "-"}</p>
                    <p className={lbl + " mt-4"}>NIK CPW</p>
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
              )}

              {/* ═══ TAB: Vendor Details ═══ */}
              {activeTab === "vendor" && (
                <div className="space-y-6">
                  {/* Vendor + Bonus unified table */}
                  {(booking.snapVendorItems.length > 0 || booking.snapBonuses.length > 0) && (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="px-4 w-40">Kategori</TableHead>
                            <TableHead className="px-4">Nama Vendor</TableHead>
                            <TableHead className="px-4 w-37.5">Nominal</TableHead>
                            <TableHead className="px-4">Keterangan</TableHead>
                            <TableHead className="px-4 w-37.5">Status Order</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {booking.snapVendorItems.filter((v) => !v.isAddons).map((v) => (
                            <TableRow key={v.id}>
                              <TableCell className="px-4 font-medium text-sm text-foreground">{v.vendorCategoryName}</TableCell>
                              <TableCell className="px-4 text-sm">{v.vendorName}</TableCell>
                              <TableCell className="px-4 text-sm">{Number(v.itemPrice) > 0 ? fmtPrice(v.itemPrice) : "-"}</TableCell>
                              <TableCell className="px-4 text-sm"><RichText html={v.description} /></TableCell>
                              <TableCell className="px-4 text-sm text-muted-foreground">{(v as typeof v & { orderStatus?: { name: string } | null }).orderStatus?.name ?? "-"}</TableCell>
                            </TableRow>
                          ))}
                          {booking.snapBonuses.length > 0 && (
                            <TableRow className="bg-muted/50">
                              <TableCell colSpan={5} className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Complimentary / Bonus</TableCell>
                            </TableRow>
                          )}
                          {booking.snapBonuses.map((b) => (
                            <TableRow key={b.id}>
                              <TableCell className="px-4 font-medium text-sm text-foreground">Complimentary</TableCell>
                              <TableCell className="px-4 text-sm">{b.vendorName}</TableCell>
                              <TableCell className="px-4 text-sm">{Number((b as typeof b & { nominal?: number | null }).nominal ?? 0) > 0 ? `Rp ${new Intl.NumberFormat("id-ID").format(Number((b as typeof b & { nominal?: number | null }).nominal))}` : "-"}</TableCell>
                              <TableCell className="px-4 text-sm"><RichText html={b.description} /></TableCell>
                              <TableCell className="px-4 text-sm text-muted-foreground">{b.orderStatus?.name ?? "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Internal items */}
                  {booking.snapPackageInternalItems.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Internal Items</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0 text-sm">
                        {booking.snapPackageInternalItems.map((item) => (
                          <div key={item.id} className="py-2 border-b last:border-b-0">
                            <p className="text-sm font-medium text-foreground">{item.itemName}</p>
                            {item.itemDescription && <RichText html={item.itemDescription} />}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Package vendor items */}
                  {booking.snapPackageVendorItems.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Paket Vendor Items</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0 text-sm">
                        {booking.snapPackageVendorItems.map((item) => (
                          <div key={item.id} className="py-2 border-b last:border-b-0">
                            <p className="text-xs text-muted-foreground">{item.categoryName}</p>
                            <RichText html={item.itemText} />
                          </div>
                        ))}
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
              {activeTab === "payment" && (
                <div className="space-y-4 text-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <p className={lbl}>Metode Pembayaran:</p>
                    <p className={val}>
                      {booking.paymentMethod?.bankName ?? "-"}
                      {booking.paymentMethod?.bankAccountNumber ? ` (${booking.paymentMethod.bankAccountNumber})` : ""}
                    </p>
                  </div>

                  {booking.termOfPayments.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Belum ada data pembayaran.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Termin</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nominal</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Jatuh Tempo</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">No. Invoice</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {booking.termOfPayments.map((t, i) => (
                            <tr key={t.id} className="border-b hover:bg-muted/50">
                              <td className="px-4 py-3 font-medium text-foreground">{t.name || `Termin ${i + 1}`}</td>
                              <td className="px-4 py-3 text-foreground">{fmtPrice(t.amount)}</td>
                              <td className="px-4 py-3 text-foreground">{fmtDate(t.dueDate, "long")}</td>
                              <td className="px-4 py-3 text-foreground">{t.invoiceNumber ?? "-"}</td>
                              <td className="px-4 py-3">
                                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                                  t.paymentStatus === "paid" ? "bg-primary/10 text-primary" :
                                  t.paymentStatus === "partial" ? "bg-muted text-foreground/70" :
                                  "bg-destructive/10 text-destructive"
                                }`}>
                                  {t.paymentStatus || "Unpaid"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

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
                    <div className="sticky bottom-0 bg-background border-t pt-3 flex items-center justify-between gap-3">
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
        onConfirm={async () => {
          if (!deleteDocTarget) return;
          setDeleting(true);
          const result = await deleteBookingDocument(deleteDocTarget.id);
          setDeleting(false);
          if (!result.success) { toast.error(result.error); return; }
          toast.success("Dokumen berhasil dihapus");
          setDeleteDocTarget(null);
          if (bookingId) fetchBooking(bookingId);
        }}
      />
      <ConfirmDialog
        open={showBulkConfirm}
        onOpenChange={(v) => { if (!v) setShowBulkConfirm(false); }}
        title="Hapus Dokumen"
        description={`Yakin mau hapus ${selectedDocIds.size} file? Semua file akan dihapus permanen.`}
        confirmLabel={bulkDeleting ? "Menghapus..." : `Hapus ${selectedDocIds.size} file`}
        destructive
        onConfirm={async () => {
          setBulkDeleting(true);
          const result = await deleteBookingDocuments([...selectedDocIds]);
          setBulkDeleting(false);
          if (!result.success) { toast.error(result.error); return; }
          toast.success(`${result.count} file berhasil dihapus`);
          setShowBulkConfirm(false);
          setSelectedDocIds(new Set());
          if (bookingId) fetchBooking(bookingId);
        }}
      />
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
          <p className="text-xs text-muted-foreground">Berlaku hingga: <span className="font-medium">{fmtDateTime(agreement.expiresAt)}</span></p>
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
