import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { db } from "@/lib/db";
import { requirePermissionForRoute } from "@/lib/permissions";
import { POPdfDocument } from "@/components/pdf/POPdfDocument";
import type { POPdfBooking } from "@/components/pdf/POPdfDocument";

export async function POST(req: Request) {
  const { session, response } = await requirePermissionForRoute({ module: "booking", action: "view" });
  if (response) return response;

  try {
    const { bookingId } = await req.json();
    if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });

    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        snapCustomer: true,
        snapVenue: true,
        snapPackage: true,
        snapPackageVariant: true,
        snapPackageInternalItems: { orderBy: { sortOrder: "asc" } },
        snapPackageVendorItems: { orderBy: { sortOrder: "asc" } },
        snapVendorItems: true,
        snapBonuses: true,
        termOfPayments: { orderBy: { sortOrder: "asc" } },
        paymentMethod: true,
        sales: true,
      },
    });

    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    const pdfBooking: POPdfBooking = {
      poNumber: booking.poNumber,
      bookingDate: booking.bookingDate,
      weddingSession: booking.weddingSession,
      weddingType: booking.weddingType,
      signingLocation: booking.signingLocation,
      snapCustomer: booking.snapCustomer,
      snapVenue: booking.snapVenue,
      snapPackage: booking.snapPackage,
      snapPackageVariant: booking.snapPackageVariant,
      snapPackageInternalItems: booking.snapPackageInternalItems,
      snapPackageVendorItems: booking.snapPackageVendorItems,
      snapVendorItems: booking.snapVendorItems,
      snapBonuses: booking.snapBonuses,
      termOfPayments: booking.termOfPayments,
      paymentMethod: booking.paymentMethod,
      sales: booking.sales ? { fullName: booking.sales.fullName ?? "" } : null,
      signatures: booking.signatures as Record<string, unknown> | null,
      createdAt: booking.createdAt,
    };

    const customerName = (booking.snapCustomer?.name ?? "Customer").replace(/[^a-zA-Z0-9]/g, "_");
    const venueName = (booking.snapVenue?.venueName ?? "Venue").replace(/[^a-zA-Z0-9]/g, "_");
    const eventDate = booking.bookingDate.toISOString().split("T")[0];
    const fileName = `PO_${customerName}_${venueName}_${eventDate}.pdf`;

    const stream = await renderToStream(
      <POPdfDocument booking={pdfBooking} logoBase64={null} />
    );

    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("[render-po]", error);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
