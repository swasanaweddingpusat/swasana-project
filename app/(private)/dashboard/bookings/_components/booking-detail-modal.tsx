"use client";

import { useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { X, FileText, Copy, RefreshCw, Link2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { generateAgreementToken, markAgreementSent } from "@/actions/client-agreement";
import type { BookingDetail } from "@/lib/queries/bookings";

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

const lbl = "text-[14px] font-medium mb-0 text-[#637587]";
const val = "text-[14px] font-normal text-black";

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

const STATUS_COLOR: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-800",
  Uploaded: "bg-blue-100 text-blue-800",
  Confirmed: "bg-green-100 text-green-800",
  Rejected: "bg-red-100 text-red-800",
  Canceled: "bg-gray-100 text-gray-700",
  Lost: "bg-purple-100 text-purple-800",
};

const AGREEMENT_COLOR: Record<string, string> = {
  Pending: "bg-gray-100 text-gray-700",
  Sent: "bg-blue-100 text-blue-800",
  Viewed: "bg-yellow-100 text-yellow-800",
  Signed: "bg-green-100 text-green-800",
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
  const [activeTab, setActiveTab] = useState<"booking" | "vendor" | "payment" | "documents">("booking");

  useEffect(() => {
    if (!open || !bookingId) return;
    setLoading(true);
    setActiveTab("booking");
    fetch(`/api/bookings/${bookingId}`)
      .then((r) => r.json())
      .then((data: BookingDetail) => setBooking(data))
      .catch(() => setBooking(null))
      .finally(() => setLoading(false));
  }, [open, bookingId]);

  if (!open) return null;

  const tabs = [
    { key: "booking" as const, label: "Booking Details" },
    { key: "vendor" as const, label: "Vendor Details" },
    { key: "payment" as const, label: "Pembayaran" },
    { key: "documents" as const, label: "Dokumen" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex sm:items-center sm:justify-center sm:bg-black/40">
      <div
        className="bg-white w-full h-full flex flex-col sm:rounded-xl sm:shadow-lg sm:w-[70%] sm:max-w-[70%] overflow-hidden sm:h-auto sm:max-h-[90vh]"
        style={{ minWidth: 0 }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex justify-between items-start px-4 sm:px-8 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          {loading ? (
            <Skeleton className="h-6 w-48" />
          ) : (
            <h2 className="text-lg sm:text-xl font-semibold flex-1 pr-4">
              {booking ? `Daftar lengkap booking ${booking.snapCustomer?.name ?? ""}` : "Detail Booking"}
            </h2>
          )}
          <button
            onClick={onClose}
            className="shrink-0 mt-0.5 rounded-full flex items-center justify-center cursor-pointer"
            aria-label="Close"
            style={{ background: "#FFD6D6", width: 32, height: 32 }}
          >
            <X size={18} className="text-[#E80606]" />
          </button>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="flex border-b border-gray-200 mb-0 px-4 sm:px-8 shrink-0">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === t.key
                  ? "border-black text-black"
                  : "border-transparent text-gray-500 hover:text-gray-700"
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
            <div className="text-center py-12 text-gray-400 text-sm">Gagal memuat data booking.</div>
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
                    <p className={val}>{booking.snapCustomer?.mobileNumber ?? "-"}</p>
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
                    <p className={val}>{booking.paymentMethod?.bankName ?? "-"}</p>
                    <p className={lbl + " mt-4"}>Package Price</p>
                    <p className={val}>{fmtPrice(booking.snapPackageVariant?.price)}</p>
                    <p className={lbl + " mt-4"}>Variant</p>
                    <p className={val}>{booking.snapPackageVariant?.variantName ?? "-"} ({booking.snapPackageVariant?.pax ?? 0} PAX)</p>
                    <p className={lbl + " mt-4"}>Manager</p>
                    <p className={val}>{booking.manager?.fullName ?? "-"}</p>
                  </div>
                  {/* Col 3 */}
                  <div>
                    <p className={lbl}>PO Number</p>
                    <p className={val}>{booking.poNumber ?? "-"}</p>
                    <p className={lbl + " mt-4"}>Wedding Type</p>
                    <p className={val}>{booking.weddingType ?? "-"}</p>
                    <p className={lbl + " mt-4"}>NIK</p>
                    <p className={val}>{booking.snapCustomer?.nikNumber ?? "-"}</p>
                    <p className={lbl + " mt-4"}>KTP Address</p>
                    <p className={val}>{booking.snapCustomer?.ktpAddress ?? "-"}</p>
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
                        <p className="text-gray-500 text-[14px] font-normal">{booking.rejectionNotes}</p>
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
                  {/* Vendor items grouped by category — 2-col grid like source */}
                  {booking.snapPackageVendorItems.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0 text-sm">
                      {booking.snapPackageVendorItems.map((item) => (
                        <div key={item.id} className="py-2 border-b border-gray-100 last:border-b-0">
                          <p className="text-xs text-gray-400">{item.categoryName}</p>
                          <p className="text-sm truncate font-medium text-gray-900">{item.itemText}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Internal items */}
                  {booking.snapPackageInternalItems.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Internal Items</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0 text-sm">
                        {booking.snapPackageInternalItems.map((item) => (
                          <div key={item.id} className="py-2 border-b border-gray-100 last:border-b-0">
                            <p className="text-sm font-medium text-gray-900">{item.itemName}</p>
                            {item.itemDescription && <p className="text-xs text-gray-400">{item.itemDescription}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Vendor booking items table */}
                  {booking.snapVendorItems.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Vendor Booking Items</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200 bg-gray-50">
                              <th className="text-left px-4 py-3 font-medium text-gray-500">Category</th>
                              <th className="text-left px-4 py-3 font-medium text-gray-500">Vendor</th>
                              <th className="text-left px-4 py-3 font-medium text-gray-500">Item</th>
                              <th className="text-right px-4 py-3 font-medium text-gray-500">Price</th>
                              <th className="text-center px-4 py-3 font-medium text-gray-500">Qty</th>
                              <th className="text-right px-4 py-3 font-medium text-gray-500">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {booking.snapVendorItems.map((v) => (
                              <tr key={v.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="px-4 py-3 text-gray-500">{v.vendorCategoryName}</td>
                                <td className="px-4 py-3 font-medium text-gray-900">{v.vendorName}</td>
                                <td className="px-4 py-3 text-gray-900">
                                  {v.itemName}
                                  {v.isAddons && <span className="ml-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">Addons</span>}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-900">{fmtPrice(v.itemPrice)}</td>
                                <td className="px-4 py-3 text-center text-gray-900">{v.qty}{v.unit ? ` ${v.unit}` : ""}</td>
                                <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtPrice(v.totalPrice)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Bonuses */}
                  {booking.snapBonuses.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Bonuses / Complimentary</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0 text-sm">
                        {booking.snapBonuses.map((b) => (
                          <div key={b.id} className="py-2 border-b border-gray-100 last:border-b-0">
                            <p className="text-sm font-medium text-gray-900">{b.vendorName} (x{b.qty})</p>
                            {b.description && <p className="text-xs text-gray-400">{b.description}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {booking.snapPackageInternalItems.length === 0 && booking.snapPackageVendorItems.length === 0 && booking.snapVendorItems.length === 0 && booking.snapBonuses.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <FileText className="h-10 w-10 text-gray-300 mb-3" />
                      <p className="text-sm text-gray-500">Belum ada data vendor.</p>
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
                    <p className="text-gray-400 text-sm">Belum ada data pembayaran.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="text-left px-4 py-3 font-medium text-gray-500">Termin</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-500">Nominal</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-500">Jatuh Tempo</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-500">No. Invoice</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {booking.termOfPayments.map((t, i) => (
                            <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900">{t.name || `Termin ${i + 1}`}</td>
                              <td className="px-4 py-3 text-gray-900">{fmtPrice(t.amount)}</td>
                              <td className="px-4 py-3 text-gray-900">{fmtDate(t.dueDate, "long")}</td>
                              <td className="px-4 py-3 text-gray-900">{t.invoiceNumber ?? "-"}</td>
                              <td className="px-4 py-3">
                                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                                  t.paymentStatus === "paid" ? "bg-green-100 text-green-700" :
                                  t.paymentStatus === "partial" ? "bg-yellow-100 text-yellow-700" :
                                  "bg-red-100 text-red-700"
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
                      <FileText className="h-10 w-10 text-gray-300 mb-3" />
                      <p className="text-sm text-gray-500">Belum ada dokumen.</p>
                      <p className="text-xs text-gray-400 mt-1">Upload dokumen melalui tombol di action table.</p>
                    </div>
                  ) : (
                    (() => {
                      const grouped: Record<string, typeof booking.bookingDocuments> = {};
                      booking.bookingDocuments.forEach((doc) => {
                        const key = doc.name;
                        if (!grouped[key]) grouped[key] = [];
                        grouped[key].push(doc);
                      });
                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {Object.entries(grouped).map(([docName, docs]) => (
                            <div key={docName} className="border border-gray-100 rounded-lg p-3">
                              <p className="text-xs font-medium text-gray-700">{docName}</p>
                              {docs[0]?.description && (
                                <p className="text-[10px] text-gray-400 mt-0.5">{docs[0].description}</p>
                              )}
                              <div className="flex flex-wrap gap-2 mt-2">
                                {docs.map((doc) => (
                                  <div key={doc.id} className="w-[100px] border border-gray-200 rounded-lg overflow-hidden bg-white">
                                    <div className="h-[80px] w-full bg-gray-50 flex items-center justify-center">
                                      <div className="flex flex-col items-center gap-1">
                                        <FileText className="h-6 w-6 text-gray-300" />
                                        <span className="text-[9px] text-gray-400 uppercase font-medium">
                                          {doc.fileName?.split(".").pop() ?? "FILE"}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="px-1.5 py-1">
                                      <p className="text-[10px] text-gray-600 truncate">{doc.fileName}</p>
                                      <p className="text-[9px] text-gray-400">
                                        {doc.fileSize < 1024 * 1024
                                          ? `${(doc.fileSize / 1024).toFixed(1)} KB`
                                          : `${(doc.fileSize / (1024 * 1024)).toFixed(1)} MB`}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()
                  )}

                  {/* Client Agreement section */}
                  <ClientAgreementSection booking={booking} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Client Agreement Sub-component ───────────────────────────────────────── */

function ClientAgreementSection({ booking }: { booking: BookingDetail }) {
  const [agreement, setAgreement] = useState(booking.clientAgreement);
  const [isPending, startTransition] = useTransition();

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

  const signatures = booking.signatures as Record<string, unknown> | null;
  const clientSig = signatures?.client as Record<string, unknown> | null;

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Client Agreement</p>
        {agreement && <Badge className={AGREEMENT_COLOR[agreement.status]}>{agreement.status}</Badge>}
      </div>
      {!agreement ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <Link2 className="h-8 w-8 text-muted-foreground" />
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
              <code className="flex-1 text-xs bg-gray-50 border rounded px-3 py-2 truncate">{agreementUrl}</code>
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(agreementUrl!); toast.success("Link disalin"); }}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Kode Akses</p>
            <div className="flex items-center gap-2">
              <code className="text-lg font-mono font-bold tracking-widest bg-gray-50 border rounded px-3 py-2">{agreement.accessCode}</code>
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(agreement!.accessCode); toast.success("Kode disalin"); }}>
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
          {typeof clientSig?.signature === "string" && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Tanda Tangan Client</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={clientSig.signature} alt="Client signature" className="h-20 border rounded bg-white p-1" />
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
            {agreement.status !== "Signed" && (
              <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isPending}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" />Regenerate
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
