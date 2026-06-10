import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { db } from "@/lib/db";
import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { POPdfDocument } from "@/components/pdf/POPdfDocument";
import type { POPdfBooking } from "@/components/pdf/POPdfDocument";
import { humanizeRoleName } from "@/lib/approval-flows";
import path from "path";
import fs from "fs/promises";

async function loadLogoBase64(fileName: string): Promise<string | null> {
  try {
    const filePath = path.join(process.cwd(), "public", fileName);
    const buffer = await fs.readFile(filePath);
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "png";
    const mime = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const { session, response } = await requirePermissionForRoute({ module: "booking", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`render-po:${session.user.id}`)) return rateLimitResponse();

  try {
    const { bookingId, revisionId } = await req.json();
    if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });

    let pdfBooking: POPdfBooking;
    let customerName: string;
    let venueName: string;
    let eventDate: string;
    let termAndConditionHtml: string | null = null;

    if (revisionId) {
      // Render from frozen revision snapshot
      const revision = await db.bookingRevision.findUnique({ where: { id: revisionId } });
      if (!revision || revision.bookingId !== bookingId) return NextResponse.json({ error: "Revision not found" }, { status: 404 });
      const snap = revision.snapshotData as Record<string, unknown>;
      pdfBooking = {
        poNumber: snap.poNumber as string | null,
        bookingDate: new Date(snap.bookingDate as string),
        weddingSession: snap.weddingSession as string | null,
        weddingType: snap.weddingType as string | null,
        eventTime: (snap.eventTime as string | null | undefined) ?? null,
        signingLocation: snap.signingLocation as string | null,
        snapCustomer: snap.snapCustomer as POPdfBooking["snapCustomer"],
        snapVenue: snap.snapVenue as POPdfBooking["snapVenue"],
        snapPackage: snap.snapPackage as POPdfBooking["snapPackage"],
        snapPackagePricing: snap.snapPackagePricing as POPdfBooking["snapPackagePricing"],
        snapPackageInternalItems: (snap.snapPackageInternalItems ?? []) as POPdfBooking["snapPackageInternalItems"],
        snapPackageVendorItems: (snap.snapPackageVendorItems ?? []) as POPdfBooking["snapPackageVendorItems"],
        snapPackageCategoryPrices: (snap.snapPackageCategoryPrices ?? []) as POPdfBooking["snapPackageCategoryPrices"],
        snapVendorItems: (snap.snapVendorItems ?? []) as POPdfBooking["snapVendorItems"],
        snapBonuses: (snap.snapBonuses ?? []) as POPdfBooking["snapBonuses"],
        snapComplimentaries: (snap.snapComplimentaries ?? []) as POPdfBooking["snapComplimentaries"],
        termOfPayments: (snap.termOfPayments ?? []) as POPdfBooking["termOfPayments"],
        paymentMethod: snap.paymentMethod as POPdfBooking["paymentMethod"],
        sales: snap.sales as POPdfBooking["sales"],
        signatures: null, // Will be populated from ApprovalRecordStep below
        createdAt: revision.createdAt,
        discountName: snap.discountName as string | null,
        discountAmount: Number(snap.discountAmount) || 0,
      };
      customerName = ((snap.snapCustomer as Record<string, unknown> | null)?.name as string ?? "Customer").replace(/[^a-zA-Z0-9]/g, "_");
      venueName = (revision.venueName ?? "Venue").replace(/[^a-zA-Z0-9]/g, "_");
      eventDate = new Date(snap.bookingDate as string).toISOString().split("T")[0];
      const bookingForTc = await db.booking.findUnique({ where: { id: bookingId }, select: { snapPackagePricing: { select: { termAndCondition: true } } } });
      termAndConditionHtml = bookingForTc?.snapPackagePricing?.termAndCondition ?? null;
    } else {
      // Render from live booking data (backward compatible)
      const booking = await db.booking.findUnique({
        where: { id: bookingId },
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

      if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

      pdfBooking = {
        poNumber: booking.poNumber,
        bookingDate: booking.bookingDate,
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
        signatures: null, // Will be populated from ApprovalRecordStep below
        createdAt: booking.createdAt,
        discountName: booking.discountName,
        discountAmount: booking.discountAmount,
      };
      customerName = (booking.snapCustomer?.name ?? "Customer").replace(/[^a-zA-Z0-9]/g, "_");
      venueName = (booking.snapVenue?.venueName ?? "Venue").replace(/[^a-zA-Z0-9]/g, "_");
      eventDate = booking.bookingDate.toISOString().split("T")[0];
      termAndConditionHtml = booking.snapPackagePricing?.termAndCondition ?? null;
    }

    const fileName = `PO_${customerName}_${venueName}_${eventDate}.pdf`;

    // Fetch signatures from ApprovalRecordStep (latest round)
    let emateraiData: { sn: string; qrBase64: string } | null = null;
    const approvalRecord = await db.approvalRecord.findUnique({
      where: { module_entityId: { module: "booking", entityId: bookingId } },
      include: { steps: { orderBy: { stepOrder: "asc" }, include: { approverRole: { select: { name: true } }, approverUser: { select: { fullName: true } }, decidedBy: { select: { fullName: true } } } } },
    });
    if (approvalRecord) {
      const steps = approvalRecord.steps;
      const roundSize = (() => { const first = steps[0]; for (let i = 1; i < steps.length; i++) { if (steps[i].approverType === first?.approverType && steps[i].approverRoleId === first?.approverRoleId) return i; } return steps.length; })();
      const latestRound = steps.slice(-roundSize);
      // PO signers = Sales (approverType "user") + Manager (role "manager") only.
      // Finance approves in-system but is intentionally excluded from the PO.
      const signerSteps = latestRound
        .filter((s) => s.approverType === "user" || (s.approverType === "role" && s.approverRole?.name === "manager"))
        .sort((a, b) => a.stepOrder - b.stepOrder);
      const clientStep = latestRound.find((s) => s.approverType === "client" && s.signature) ?? null;
      pdfBooking.signatures = {
        ...(clientStep ? { client: { signature: clientStep.signature! } } : {}),
        roles: signerSteps.map((step) => ({
          ...(step.signature ? { signature: step.signature } : {}),
          name: step.decidedBy?.fullName ?? step.approverUser?.fullName ?? "",
          title: step.approverType === "user" ? "Sales" : humanizeRoleName(step.approverRole?.name),
        })),
      };
      emateraiData =
        approvalRecord.emateraiSn && approvalRecord.emateraiQrBase64
          ? { sn: approvalRecord.emateraiSn, qrBase64: approvalRecord.emateraiQrBase64 }
          : null;
    }

    const logoBase64 = await loadLogoBase64("swasana-logo.png");

    const stream = await renderToStream(
      <POPdfDocument booking={pdfBooking} logoBase64={logoBase64} termAndConditionHtml={termAndConditionHtml} ematerai={emateraiData} />
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
