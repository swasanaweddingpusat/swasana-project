import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import path from "path";
import fs from "fs/promises";
import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { hasPermission } from "@/lib/permissions";
import { getPayslipById } from "@/lib/queries/payslips";
import { PayslipPdfDocument } from "@/components/pdf/PayslipPdfDocument";

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

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!apiLimiter.check(`payslip-pdf:${session.user.id}`)) return rateLimitResponse();

  try {
    const { id } = await params;
    const payslip = await getPayslipById(id);
    if (!payslip) return Response.json({ error: "Not found" }, { status: 404 });

    const isOwner = payslip.profileId === session.user.profileId;
    const canViewAll = await hasPermission(session.user.roleId, "hr-payroll", "view");

    if (!isOwner && !canViewAll) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // If a pre-generated PDF URL exists, redirect to it
    if (payslip.pdfUrl) {
      return Response.redirect(payslip.pdfUrl, 302);
    }

    const logoBase64 = await loadLogoBase64("swasana-logo.png");

    const stream = await renderToStream(
      <PayslipPdfDocument
        data={{
          employeeName: payslip.employeeName,
          employeeNumber: payslip.employeeNumber,
          departmentName: payslip.departmentName,
          positionName: payslip.positionName,
          npwp: payslip.npwp,
          ptkpStatus: payslip.ptkpStatus,
          periodMonth: payslip.payrollPeriod.month,
          periodYear: payslip.payrollPeriod.year,
          totalEarnings: Number(payslip.totalEarnings),
          totalDeductions: Number(payslip.totalDeductions),
          netSalary: Number(payslip.netSalary),
          totalWorkDays: payslip.totalWorkDays,
          totalPresent: payslip.totalPresent,
          totalAbsent: payslip.totalAbsent,
          totalLate: payslip.totalLate,
          totalLeave: payslip.totalLeave,
          items: payslip.items.map((item) => ({
            name: item.name,
            type: item.type,
            amount: Number(item.amount),
            sortOrder: item.sortOrder,
          })),
        }}
        logoBase64={logoBase64}
      />,
    );

    const employeeName = payslip.employeeName.replace(/[^a-zA-Z0-9]/g, "_");
    const periodLabel = `${MONTH_NAMES[(payslip.payrollPeriod.month ?? 1) - 1]}_${payslip.payrollPeriod.year}`;
    const fileName = `Slip_Gaji_${employeeName}_${periodLabel}.pdf`;

    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[GET /api/hr/payslips/[id]/pdf]", error);
    return Response.json({ error: "Failed to generate payslip" }, { status: 500 });
  }
}
