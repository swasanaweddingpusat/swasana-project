import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { humanizeRoleName } from "@/lib/approval-flows";
import { POPdfDocumentV2 } from "@/components/pdf/POPdfDocumentV2";
import type { POPdfBooking } from "@/components/pdf/POPdfDocument";
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

const schema = z.object({
  bookingId: z.string().min(1, "bookingId required"),
  revisionId: z.string().optional(),
});

export async function POST(req: Request): Promise<Response> {
  // 1. Authorization
  const { session, response } = await requirePermissionForRoute({ module: "booking", action: "view" });
  if (response) return response;

  // 2. Rate limit
  if (!apiLimiter.check(`render-po-v2:${session.user.id}`)) return rateLimitResponse();

  try {
    // 3. Validate
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const { bookingId, revisionId } = parsed.data;

    let pdfBooking: POPdfBooking;

    if (revisionId) {
      const revision = await db.bookingRevision.findUnique({ where: { id: revisionId } });
      if (!revision || revision.bookingId !== bookingId) return NextResponse.json({ error: "Revision not found" }, { status: 404 });
      const snap = revision.snapshotData as Record<string, unknown>;
      pdfBooking = {
        poNumber: snap.poNumber as string | null,
        bookingDate: new Date((snap.eventDate ?? snap.bookingDate) as string),
        weddingSession: snap.weddingSession as string | null,
        weddingType: snap.weddingType as string | null,
        eventTime: (snap.eventTime as string | null | undefined) ?? null,
        signingLocation: snap.signingLocation as string | null,
        notes: (snap.notes as string | null | undefined) ?? null,
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
        manager: (snap.manager as POPdfBooking["manager"]) ?? null,
        signatures: null,
        createdAt: revision.createdAt,
        discountName: snap.discountName as string | null,
        discountAmount: Number(snap.discountAmount) || 0,
      };
    } else {
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
          manager: { select: { fullName: true } },
        },
      });
      if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

      pdfBooking = {
        poNumber: booking.poNumber,
        bookingDate: booking.eventDate ?? booking.createdAt,
        weddingSession: booking.weddingSession,
        weddingType: booking.weddingType,
        eventTime: booking.eventTime ?? null,
        signingLocation: booking.signingLocation,
        notes: booking.notes,
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
        manager: booking.manager ? { fullName: booking.manager.fullName } : null,
        signatures: null,
        createdAt: booking.createdAt,
        discountName: booking.discountName,
        discountAmount: booking.discountAmount,
      };
    }

    // Signatures — same logic as V1 (filter by current/explicit revision, fallback all)
    let sigRevisionId: string | null = revisionId ?? null;
    if (!sigRevisionId) {
      const sigBooking = await db.booking.findUnique({ where: { id: bookingId }, select: { currentRevisionId: true } });
      sigRevisionId = sigBooking?.currentRevisionId ?? null;
    }
    const approvalRecord = await db.approvalRecord.findUnique({
      where: { module_entityId: { module: "booking", entityId: bookingId } },
      include: { steps: { orderBy: { stepOrder: "asc" }, include: { approverRole: { select: { name: true } }, approverUser: { select: { fullName: true } }, decidedBy: { select: { fullName: true } } } } },
    });
    if (approvalRecord) {
      const allSteps = approvalRecord.steps;
      const hasRevisionedSteps = allSteps.some((s) => s.revisionId !== null);
      const revisionSteps = (sigRevisionId && hasRevisionedSteps) ? allSteps.filter((s) => s.revisionId === sigRevisionId) : allSteps;
      const signerSteps = revisionSteps
        .filter((s) => s.approverType === "user" || (s.approverType === "role" && s.approverRole?.name === "manager"))
        .sort((a, b) => a.stepOrder - b.stepOrder);
      const clientStep = revisionSteps.find((s) => s.approverType === "client" && s.signature) ?? null;
      pdfBooking.signatures = {
        ...(clientStep ? { client: { signature: clientStep.signature! } } : {}),
        roles: signerSteps.map((step) => ({
          ...(step.signature ? { signature: step.signature } : {}),
          name: step.decidedBy?.fullName ?? step.approverUser?.fullName ?? "",
          title: step.approverType === "user" ? "Sales" : humanizeRoleName(step.approverRole?.name),
        })),
      };
    }

    const customerName = (pdfBooking.snapCustomer?.name ?? "Customer").replace(/[^a-zA-Z0-9]/g, "_");
    const fileName = `PO_V2_${customerName}.pdf`;
    const logoBase64 = await loadLogoBase64("swasana-logo.png");

    const stream = await renderToStream(<POPdfDocumentV2 booking={pdfBooking} logoBase64={logoBase64} />);

    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("[render-po-v2]", error);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
