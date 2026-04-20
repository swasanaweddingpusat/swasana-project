"use client";

import type { BookingDetail } from "@/lib/queries/bookings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";

const statusColor: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-800",
  Uploaded: "bg-blue-100 text-blue-800",
  Confirmed: "bg-green-100 text-green-800",
  Rejected: "bg-red-100 text-red-800",
  Canceled: "bg-gray-100 text-gray-700",
  Lost: "bg-purple-100 text-purple-800",
};

const paymentStatusColor: Record<string, string> = {
  unpaid: "bg-red-100 text-red-800",
  paid: "bg-green-100 text-green-800",
  partial: "bg-yellow-100 text-yellow-800",
};

function fmtPrice(value: bigint | number | null | undefined) {
  if (value == null) return "-";
  return `Rp ${new Intl.NumberFormat("id-ID").format(Number(value))}`;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2 py-1">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-sm font-medium text-right">{value || "-"}</span>
    </div>
  );
}

export function BookingDetailView({ booking }: { booking: BookingDetail }) {
  const snap = booking.snapCustomer;
  const venue = booking.snapVenue;
  const pkg = booking.snapPackage;
  const variant = booking.snapPackageVariant;

  return (
    <>
      {/* Back button */}
      <Link href="/dashboard/bookings" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-fit">
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Bookings
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{snap?.name ?? "-"}</h1>
          <div className="flex items-center gap-2">
            <Badge className={statusColor[booking.bookingStatus]}>{booking.bookingStatus}</Badge>
            <span className="text-sm text-muted-foreground">{format(booking.bookingDate, "dd MMM yyyy")}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => toast("Coming soon")}>
            <FileText className="h-4 w-4 mr-1" /> Client Agreement
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast("Coming soon")}>
            <ShoppingCart className="h-4 w-4 mr-1" /> Purchase Order
          </Button>
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Info Booking */}
        <Card>
          <CardHeader><CardTitle>Info Booking</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <InfoRow label="Status" value={<Badge className={statusColor[booking.bookingStatus]}>{booking.bookingStatus}</Badge>} />
            <InfoRow label="Wedding Type" value={booking.weddingType} />
            <InfoRow label="Session" value={booking.weddingSession} />
            <InfoRow label="PO Number" value={booking.poNumber} />
            <InfoRow label="Sales" value={booking.sales?.fullName} />
            <InfoRow label="Manager" value={booking.manager?.fullName} />
            <InfoRow label="Source of Info" value={booking.sourceOfInformation?.name} />
            <InfoRow label="Payment Method" value={booking.paymentMethod?.bankName} />
          </CardContent>
        </Card>

        {/* Card 2: Info Customer */}
        <Card>
          <CardHeader><CardTitle>Info Customer</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <InfoRow label="Name" value={snap?.name} />
            <InfoRow label="Email" value={snap?.email} />
            <InfoRow label="Mobile" value={snap?.mobileNumber} />
            <InfoRow label="NIK" value={snap?.nikNumber} />
            <InfoRow label="KTP Address" value={snap?.ktpAddress} />
          </CardContent>
        </Card>

        {/* Card 3: Info Venue */}
        <Card>
          <CardHeader><CardTitle>Info Venue</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <InfoRow label="Venue" value={venue?.venueName} />
            <InfoRow label="Brand" value={venue?.brandName} />
            <InfoRow label="Address" value={venue?.address} />
            <InfoRow label="Description" value={venue?.description} />
          </CardContent>
        </Card>

        {/* Card 4: Package */}
        <Card>
          <CardHeader><CardTitle>Package</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <InfoRow label="Package" value={pkg?.packageName} />
            <InfoRow label="Variant" value={variant?.variantName} />
            <InfoRow label="Pax" value={variant?.pax} />
            <InfoRow label="Price" value={fmtPrice(variant?.price)} />
          </CardContent>
        </Card>

        {/* Card 5: Package Items */}
        <Card>
          <CardHeader><CardTitle>Package Items</CardTitle></CardHeader>
          <CardContent>
            {booking.snapPackageInternalItems.length === 0 && booking.snapPackageVendorItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada item</p>
            ) : (
              <div className="space-y-3">
                {booking.snapPackageInternalItems.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Internal Items</p>
                    <ul className="space-y-1">
                      {booking.snapPackageInternalItems.map((item) => (
                        <li key={item.id} className="text-sm">{item.itemName}{item.itemDescription ? ` — ${item.itemDescription}` : ""}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {booking.snapPackageVendorItems.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Vendor Items</p>
                    <ul className="space-y-1">
                      {booking.snapPackageVendorItems.map((item) => (
                        <li key={item.id} className="text-sm">{item.categoryName}: {item.itemText}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 6: Bonuses */}
        <Card>
          <CardHeader><CardTitle>Bonuses / Complimentary</CardTitle></CardHeader>
          <CardContent>
            {booking.snapBonuses.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada bonus</p>
            ) : (
              <ul className="space-y-1">
                {booking.snapBonuses.map((b) => (
                  <li key={b.id} className="text-sm">
                    {b.vendorName} {b.description ? `— ${b.description}` : ""} (x{b.qty})
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Card 7: Term of Payments */}
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Term of Payments</CardTitle></CardHeader>
          <CardContent>
            {booking.termOfPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada termin</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Amount</th>
                      <th className="py-2 pr-4">Due Date</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {booking.termOfPayments.map((t) => (
                      <tr key={t.id} className="border-b last:border-0">
                        <td className="py-2 pr-4">{t.name}</td>
                        <td className="py-2 pr-4">{fmtPrice(t.amount)}</td>
                        <td className="py-2 pr-4">{format(t.dueDate, "dd MMM yyyy")}</td>
                        <td className="py-2">
                          <Badge className={paymentStatusColor[t.paymentStatus]}>{t.paymentStatus}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 8: Documents */}
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
          <CardContent>
            {booking.bookingDocuments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada dokumen</p>
            ) : (
              <ul className="space-y-2">
                {booking.bookingDocuments.map((doc) => (
                  <li key={doc.id} className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>{doc.name}</span>
                    {doc.description && <span className="text-muted-foreground">— {doc.description}</span>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
