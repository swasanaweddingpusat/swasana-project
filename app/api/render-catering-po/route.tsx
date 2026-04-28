import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { db } from "@/lib/db";
import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { CateringPOPdf } from "@/components/pdf/CateringPOPdf";
import type { POCateringV2 } from "@/types/po-catering";
import { format } from "date-fns";
import path from "path";
import fs from "fs/promises";

async function loadLogo(): Promise<string | null> {
  try {
    const buf = await fs.readFile(path.join(process.cwd(), "public", "swasana-logo.png"));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch { return null; }
}

export async function POST(req: Request) {
  const { session, response } = await requirePermissionForRoute({ module: "booking", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`render-catering-po:${session.user.id}`)) return rateLimitResponse();

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
        snapVendorItems: true,
      },
    });
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    const cateringItem = booking.snapVendorItems.find((v) => v.vendorCategoryName.toLowerCase().includes("catering") && !v.isAddons);
    if (!cateringItem?.paketData) return NextResponse.json({ error: "Data catering belum diisi" }, { status: 400 });

    const poData = cateringItem.paketData as unknown as POCateringV2;
    if (poData.version !== 2) return NextResponse.json({ error: "Format data tidak didukung" }, { status: 400 });

    const logoBase64 = await loadLogo();
    const customerName = booking.snapCustomer?.name ?? "Customer";

    const stream = await renderToStream(
      <CateringPOPdf
        booking={{
          poNumber: booking.poNumber,
          customerName,
          venueName: booking.snapVenue?.venueName ?? "-",
          brandName: booking.snapVenue?.brandName ?? "-",
          bookingDate: format(booking.bookingDate, "dd MMM yyyy"),
          weddingSession: booking.weddingSession,
          packageName: booking.snapPackage?.packageName ?? "-",
          pax: booking.snapPackageVariant?.pax ?? 0,
        }}
        vendorName={cateringItem.vendorName}
        poData={poData}
        logoBase64={logoBase64}
        signatures={booking.signatures as Record<string, Record<string, Record<string, string>>> | null}
      />
    );

    const fileName = `PO_Catering_${customerName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;

    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("[render-catering-po]", error);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
