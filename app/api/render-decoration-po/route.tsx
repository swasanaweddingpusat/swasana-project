import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { db } from "@/lib/db";
import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { DecorationPOPdf } from "@/components/pdf/DecorationPOPdf";
import type { POCateringV2 } from "@/types/po-catering";
import { format } from "date-fns";
import path from "path";
import fs from "fs/promises";

const DECORATION_KEYWORDS = ["dekorasi", "decoration", "decor", "dekor"];

async function loadLogo(): Promise<string | null> {
  try {
    const buf = await fs.readFile(path.join(process.cwd(), "public", "swasana-logo.png"));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch { return null; }
}

export async function POST(req: Request) {
  const { session, response } = await requirePermissionForRoute({ module: "booking", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`render-decoration-po:${session.user.id}`)) return rateLimitResponse();

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

    const decorationItem = booking.snapVendorItems.find((v) =>
      DECORATION_KEYWORDS.some((k) => v.vendorCategoryName.toLowerCase().includes(k)) && !v.isAddons
    );
    if (!decorationItem?.paketData) return NextResponse.json({ error: "Data dekorasi belum diisi" }, { status: 400 });

    const poData = decorationItem.paketData as unknown as POCateringV2;
    if (poData.version !== 2) return NextResponse.json({ error: "Format data tidak didukung" }, { status: 400 });

    const logoBase64 = await loadLogo();
    const customerName = booking.snapCustomer?.name ?? "Customer";

    const stream = await renderToStream(
      <DecorationPOPdf
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
        vendorName={decorationItem.vendorName}
        poData={poData}
        logoBase64={logoBase64}
        signatures={booking.signatures as Record<string, Record<string, Record<string, string>>> | null}
      />
    );

    const fileName = `PO_Dekorasi_${customerName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;

    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("[render-decoration-po]", error);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
