import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";

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
            snapPackageVariant: true,
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

    if (agreement.status === "Signed") {
      return NextResponse.json({ error: "Agreement sudah ditandatangani" }, { status: 400 });
    }

    if (agreement.expiresAt < new Date()) {
      return NextResponse.json({ error: "Link sudah expired" }, { status: 400 });
    }

    if (agreement.accessCode !== accessCode.trim().toUpperCase()) {
      return NextResponse.json({ error: "Kode akses salah" }, { status: 401 });
    }

    if (agreement.status !== "Viewed") {
      await db.clientAgreement.update({
        where: { token },
        data: { status: "Viewed", viewedAt: new Date() },
      });
    }

    return NextResponse.json({ booking: agreement.booking });
  } catch {
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
