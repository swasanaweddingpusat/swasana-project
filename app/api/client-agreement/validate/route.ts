import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!apiLimiter.check(`ca-validate:${ip}`)) return rateLimitResponse();

  try {
    const { token, accessCode } = await req.json();

    if (!token || !accessCode) {
      return NextResponse.json({ error: "Token dan kode akses wajib diisi" }, { status: 400 });
    }

    const agreement = await db.clientAgreement.findUnique({
      where: { token },
      include: {
        booking: {
          include: {
            customer: true,
            venue: { include: { brand: true } },
            snapCustomer: true,
            snapVenue: true,
            snapPackage: true,
            snapPackagePricing: true,
            snapPackageVendorItems: { orderBy: { sortOrder: "asc" } },
            snapVendorItems: true,
            snapPackageInternalItems: true,
            termOfPayments: { orderBy: { dueDate: "asc" } },
            paymentMethod: true,
            sales: true,
          },
        },
      },
    });

    if (!agreement) {
      return NextResponse.json({ error: "Link tidak valid" }, { status: 404 });
    }

    if (agreement.accessCode !== accessCode.trim().toUpperCase()) {
      return NextResponse.json({ error: "Kode akses salah" }, { status: 401 });
    }

    const currentStatus = agreement.status as string;

    // Links never expire (no expiry gate). An already-signed agreement is NOT rejected
    // here — the client is let back in with `alreadySigned: true` so the public page
    // routes them straight to the download step instead of the signing form.
    if (currentStatus !== "Viewed" && currentStatus !== "Signed") {
      await db.clientAgreement.update({
        where: { token },
        data: { status: "Viewed", viewedAt: new Date() },
      });
      await logAudit({
        action: "client_agreement.viewed",
        entityType: "booking",
        entityId: agreement.bookingId,
        description: `Client membuka & melihat dokumen agreement`,
      });
    }

    return new Response(JSON.stringify({
      booking: agreement.booking,
      alreadySigned: currentStatus === "Signed",
    }, (_key, val) => typeof val === "bigint" ? val.toString() : val), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[ca-validate]", e);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
