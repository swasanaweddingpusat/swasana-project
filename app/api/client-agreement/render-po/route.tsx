import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { db } from "@/lib/db";
import { POPdfDocument } from "@/components/pdf/POPdfDocument";
import { getBaseUrl } from "@/lib/url";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
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

    if (agreement.expiresAt < new Date()) {
      return NextResponse.json({ error: "Link expired" }, { status: 400 });
    }

    const booking = await db.booking.findUnique({
      where: { id: agreement.bookingId },
      include: {
        snapCustomer: true,
        snapVenue: true,
        snapPackage: true,
        snapPackageVariant: true,
        snapPackageInternalItems: { orderBy: { sortOrder: "asc" } },
        snapPackageVendorItems: { orderBy: { sortOrder: "asc" } },
        snapPackageCategoryPrices: { select: { categoryName: true, basePrice: true, isTakeout: true } },
        snapVendorItems: true,
        snapBonuses: true,
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
      snapPackageCategoryPrices: booking.snapPackageCategoryPrices,
      snapVendorItems: booking.snapVendorItems,
      snapBonuses: booking.snapBonuses,
      termOfPayments: booking.termOfPayments,
      paymentMethod: booking.paymentMethod,
      sales: booking.sales ? { fullName: booking.sales.fullName ?? "" } : null,
      signatures: null, // will be populated from ApprovalRecordStep below
      createdAt: booking.createdAt,
      discountName: booking.discountName,
      discountAmount: booking.discountAmount,
    };


    let termAndConditionHtml: string | null;
    if (booking.packageVariantId) {
      const pv = await db.packageVariant.findUnique({ where: { id: booking.packageVariantId }, select: { termAndCondition: true } });
      termAndConditionHtml = pv?.termAndCondition ?? null;
    } else {
      termAndConditionHtml = null;
    }

    let emateraiData: { sn: string; qrBase64: string } | null = null;
    const approvalRecord = await db.approvalRecord.findUnique({
      where: { module_entityId: { module: "booking", entityId: booking.id } },
      include: { steps: { orderBy: { stepOrder: "asc" }, include: { decidedBy: { select: { fullName: true } } } } },
    });
    if (approvalRecord) {
      emateraiData =
        approvalRecord.emateraiSn && approvalRecord.emateraiQrBase64
          ? { sn: approvalRecord.emateraiSn, qrBase64: approvalRecord.emateraiQrBase64 }
          : null;

      const steps = approvalRecord.steps;
      const roundSize = (() => { const first = steps[0]; for (let i = 1; i < steps.length; i++) { if (steps[i].approverType === first?.approverType && steps[i].approverRoleId === first?.approverRoleId) return i; } return steps.length; })();
      const latestRound = steps.slice(-roundSize);
      const roleStepsWithSig = latestRound.filter((s) => s.approverType === "role" && s.signature).sort((a, b) => a.stepOrder - b.stepOrder);
      const salesStep = roleStepsWithSig[0] ?? null;
      const managerStep = roleStepsWithSig[1] ?? null;
      pdfBooking.signatures = {
        ...(salesStep ? { sales: { signature: salesStep.signature!, name: salesStep.decidedBy?.fullName ?? "" } } : {}),
        ...(managerStep ? { manager: { signature: managerStep.signature!, name: managerStep.decidedBy?.fullName ?? "" } } : {}),
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
