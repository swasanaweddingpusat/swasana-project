import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { hasPermission } from "@/lib/permissions";
import { getPayslipById } from "@/lib/queries/payslips";
import { generatePayslipHtml } from "@/lib/payroll/pdf-generator";

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

    // Generate print-ready HTML on the fly
    const html = generatePayslipHtml({
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
      pph21Amount: Number(payslip.pph21Amount),
      pph21Method: payslip.pph21Method,
      totalWorkDays: payslip.totalWorkDays,
      totalPresent: payslip.totalPresent,
      totalAbsent: payslip.totalAbsent,
      totalLate: payslip.totalLate,
      totalLeave: payslip.totalLeave,
      absenceDeduction: Number(payslip.absenceDeduction),
      lateDeduction: Number(payslip.lateDeduction),
      bpjsKesEmployee: Number(payslip.bpjsKesEmployee),
      jhtEmployee: Number(payslip.jhtEmployee),
      jpEmployee: Number(payslip.jpEmployee),
      items: payslip.items.map((item) => ({
        name: item.name,
        type: item.type,
        amount: Number(item.amount),
        sortOrder: item.sortOrder,
      })),
    });

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return Response.json({ error: "Failed to generate payslip" }, { status: 500 });
  }
}
