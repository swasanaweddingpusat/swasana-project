import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { POPdfDocument } from "@/components/pdf/POPdfDocument";
import type { POPdfBooking } from "@/components/pdf/POPdfDocument";
import path from "path";
import fs from "fs/promises";

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function sanitizeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "_");
}

// ─── Validation ───────────────────────────────────────────────────────────────

const renderPOPackageSchema = z.object({
  packageId: z.string().min(1, "packageId required"),
  variantId: z.string().min(1, "variantId required"),
});

// ─── Route Handler ───────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // 1. Authorization
  const { session, response } = await requirePermissionForRoute({ module: "package", action: "view" });
  if (response) return response;

  // 2. Rate limit (apiLimiter — 60/min, read-only operation)
  if (!apiLimiter.check(`render-po-package:${session.user.id}`)) return rateLimitResponse();

  try {
    // 3. Validate input
    const body: unknown = await req.json();
    const parsed = renderPOPackageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }
    const { packageId, variantId } = parsed.data;

    // 4. Query — read package with the specified variant
    const pkg = await db.package.findUnique({
      where: { id: packageId },
      include: {
        venue: { include: { brand: true } },
        variants: {
          where: { id: variantId },
          include: {
            internalItems: { orderBy: { sortOrder: "asc" } },
            vendorItems: { orderBy: { sortOrder: "asc" } },
            categoryPrices: { orderBy: { sortOrder: "asc" } },
          },
        },
      },
    });

    if (!pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    const variant = pkg.variants[0];
    if (!variant) {
      return NextResponse.json({ error: "Variant not found" }, { status: 404 });
    }

    // 5. Map to POPdfBooking
    // BLANK fills all customer string fields to render as printable form lines
    const BLANK = "___________________";
    // placeholder is the literal "{}" the user requested for TOP section & other stub fields
    const PLACEHOLDER = "{}";

    const pdfBooking: POPdfBooking = {
      // ── Booking-level stub fields ───────────────────────────────────────────
      poNumber: PLACEHOLDER,
      bookingDate: new Date(),
      weddingSession: PLACEHOLDER,
      weddingType: PLACEHOLDER,
      signingLocation: PLACEHOLDER,

      // ── Customer — all BLANK to render as blank form lines ─────────────────
      snapCustomer: {
        name: BLANK,
        mobileNumber: BLANK,
        nikNumber: BLANK,
        ktpAddress: BLANK,
      },

      // ── Venue — from live DB ────────────────────────────────────────────────
      snapVenue: {
        venueName: pkg.venue?.name ?? BLANK,
        address: pkg.venue?.address ?? "",
        description: pkg.venue?.description ?? null,
        brandName: pkg.venue?.brand?.name ?? "",
        brandCode: pkg.venue?.brand?.code ?? "",
      },

      // ── Package ─────────────────────────────────────────────────────────────
      snapPackage: {
        packageName: pkg.packageName,
        notes: pkg.notes ?? null,
      },

      // ── Variant ─────────────────────────────────────────────────────────────
      snapPackageVariant: {
        variantName: variant.variantName,
        pax: variant.pax,
        price: variant.sellingPrice,
      },

      // ── Items — from live DB, sorted by sortOrder asc (already in query) ───
      snapPackageInternalItems: variant.internalItems.map((i) => ({
        id: i.id,
        itemName: i.itemName,
        itemDescription: i.itemDescription,
        sortOrder: i.sortOrder,
      })),

      snapPackageVendorItems: variant.vendorItems.map((i) => ({
        id: i.id,
        categoryName: i.categoryName,
        itemText: i.itemText,
        sortOrder: i.sortOrder,
      })),

      // ── Category Prices — isTakeout defaults false (field not on live model) ─
      snapPackageCategoryPrices: variant.categoryPrices.map((c) => ({
        categoryName: c.categoryName,
        basePrice: c.basePrice,
        isTakeout: false,
      })),

      // ── Vendor items & bonuses — not applicable for Package preview ────────
      snapVendorItems: [],
      snapBonuses: [],

      // ── Term of Payments — 1 dummy row with "{}" string stubs ──────────────
      // TYPE NOTE: amount must be number per POPdfBooking type.
      // Using 0 (not string "{}") to stay type-safe. name field is string → "{}" is valid.
      // The TOP section body text is rendered from getTerms() (hardcoded) — not from this array.
      // The payment calculation section will show Rp0 / empty, which is correct for a preview.
      termOfPayments: [
        {
          id: "preview-dummy",
          name: PLACEHOLDER,
          amount: 0,
          dueDate: null,
          paymentStatus: "pending",
        },
      ],

      // ── Optional / not applicable ────────────────────────────────────────────
      paymentMethod: null,
      sales: null,
      signatures: null,
      createdAt: new Date(),
      discountName: null,
      discountAmount: 0,
    };

    // 6. Load T&C from variant (may be null for preview — falls back to hardcoded termsList)
    const termAndConditionHtml: string | null = variant.termAndCondition ?? null;

    // 7. Logo
    const logoBase64 = await loadLogoBase64("swasana-logo.png");

    // 8. Render PDF stream
    const stream = await renderToStream(
      <POPdfDocument
        booking={pdfBooking}
        logoBase64={logoBase64}
        termAndConditionHtml={termAndConditionHtml}
        ematerai={null}
        previewMode
      />,
    );

    // 9. Build filename — sanitize non-alphanumeric chars
    const safePkgName = sanitizeFilename(pkg.packageName);
    const safeVariantName = sanitizeFilename(variant.variantName);
    const fileName = `PO_PREVIEW_${safePkgName}_${safeVariantName}.pdf`;

    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("[render-po-package]", error);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
