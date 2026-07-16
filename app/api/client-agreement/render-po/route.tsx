import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { db } from "@/lib/db";
import { POPdfDocument } from "@/components/pdf/POPdfDocument";
import { getBaseUrl } from "@/lib/url";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { humanizeRoleName } from "@/lib/approval-flows";
import { getPoPayments } from "@/lib/queries/getPoPayments";
async function loadImageAsBase64(fileName: string): Promise<string | null> {
  try {
    const base = await getBaseUrl();
    const res = await fetch(`${base}/${fileName}`);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "png";
    const mime = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
    return `data:${mime};base64,${Buffer.from(buffer).toString("base64")}`;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!apiLimiter.check(`ca-render:${ip}`)) return rateLimitResponse();

  try {
    const { token, accessCode } = await req.json();

    if (!token || !accessCode) {
      return NextResponse.json({ error: "Token dan kode akses wajib" }, { status: 400 });
    }

    const agreement = await db.clientAgreement.findUnique({ where: { token } });

    if (!agreement || agreement.accessCode !== accessCode.trim().toUpperCase()) {
      return NextResponse.json({ error: "Tidak valid" }, { status: 401 });
    }

    // Links never expire — no expiry gate. Signed agreements still render here so the
    // client can re-download their signed PO copy on any later visit.
    const booking = await db.booking.findUnique({
      where: { id: agreement.bookingId },
      include: {
        snapCustomer: true,
        snapVenue: true,
        snapPackage: true,
        snapPackagePricing: true,
        snapPackageInternalItems: { orderBy: { sortOrder: "asc" } },
        snapPackageVendorItems: { orderBy: { sortOrder: "asc" } },
        snapPackageCategoryPrices: { select: { categoryName: true, basePrice: true, isTakeout: true } },
        snapVendorItems: true,
        snapBonuses: true,
        snapComplimentaries: { orderBy: { sortOrder: "asc" } },
        termOfPayments: { orderBy: { sortOrder: "asc" } },
        paymentMethod: true,
        sales: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking tidak ditemukan" }, { status: 404 });
    }

    const logoBase64 = await loadImageAsBase64("swasana-logo.png");

    const pdfBooking: import("@/components/pdf/POPdfDocument").POPdfBooking = {
      poNumber: booking.poNumber,
      bookingDate: booking.eventDate!, // confirmed bookings always have eventDate
      weddingSession: booking.weddingSession,
      weddingType: booking.weddingType,
      eventTime: booking.eventTime ?? null,
      signingLocation: booking.signingLocation,
      snapCustomer: booking.snapCustomer,
      snapVenue: booking.snapVenue,
      snapPackage: booking.snapPackage,
      snapPackagePricing: booking.snapPackagePricing,
      snapPackageInternalItems: booking.snapPackageInternalItems,
      snapPackageVendorItems: booking.snapPackageVendorItems,
      snapPackageCategoryPrices: booking.snapPackageCategoryPrices,
      snapVendorItems: booking.snapVendorItems,
      snapBonuses: booking.snapBonuses,
      snapComplimentaries: booking.snapComplimentaries,
      termOfPayments: booking.termOfPayments,
      paymentMethod: booking.paymentMethod,
      sales: booking.sales ? { fullName: booking.sales.fullName ?? "" } : null,
      signatures: null, // will be populated from ApprovalRecordStep below
      createdAt: booking.createdAt,
      discountName: booking.discountName,
      discountAmount: booking.discountAmount,
    };

    // Payments di PO = event SETELAH snapshot freeze → SELALU live-fetch (tidak ikut
    // revisi). Sama seperti /api/render-po — tanpa ini section "Summary Payment"
    // kehilangan baris booking fee/angsuran & Sisa Bayar jadi = total penuh.
    pdfBooking.poPayments = await getPoPayments(booking.id);

    const termAndConditionHtml: string | null = booking.snapPackagePricing?.termAndCondition ?? null;

    let emateraiData: { sn: string; qrBase64: string } | null = null;
    const approvalRecord = await db.approvalRecord.findUnique({
      where: { module_entityId: { module: "booking", entityId: booking.id } },
      include: { steps: { orderBy: { stepOrder: "asc" }, include: { decidedBy: { select: { fullName: true } }, approverRole: { select: { name: true } }, approverUser: { select: { fullName: true } } } } },
    });
    if (approvalRecord) {
      emateraiData =
        approvalRecord.emateraiSn && approvalRecord.emateraiQrBase64
          ? { sn: approvalRecord.emateraiSn, qrBase64: approvalRecord.emateraiQrBase64 }
          : null;

      const allSteps = approvalRecord.steps;

      // Filter steps by currentRevisionId (snapshot approach).
      // Fallback: if no steps have revisionId (legacy data) → use all steps.
      const currentRevisionId = booking.currentRevisionId ?? null;
      const hasRevisionedSteps = allSteps.some((s) => s.revisionId !== null);
      const revisionSteps = (currentRevisionId && hasRevisionedSteps)
        ? allSteps.filter((s) => s.revisionId === currentRevisionId)
        : allSteps;

      const clientStep = revisionSteps.find((s) => s.approverType === "client" && s.signature) ?? null;
      // PO signers = Sales (approverType "user") + Manager only. Finance excluded.
      const signerSteps = revisionSteps
        .filter((s) => s.approverType === "user" || (s.approverType === "role" && s.approverRole?.name === "manager"))
        .sort((a, b) => a.stepOrder - b.stepOrder);
      pdfBooking.signatures = {
        ...(clientStep ? { client: { signature: clientStep.signature! } } : {}),
        roles: signerSteps.map((step) => ({
          ...(step.signature ? { signature: step.signature } : {}),
          name: step.decidedBy?.fullName ?? step.approverUser?.fullName ?? "",
          title: step.approverType === "user" ? "Sales" : humanizeRoleName(step.approverRole?.name),
        })),
      };
    }

    const pdfElement = <POPdfDocument booking={pdfBooking} logoBase64={logoBase64} termAndConditionHtml={termAndConditionHtml} ematerai={emateraiData} />;

    const stream = await renderToStream(pdfElement);

    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
      },
    });
  } catch (error) {
    console.error("[render-po] Error:", error);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
