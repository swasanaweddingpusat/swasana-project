import { db } from "@/lib/db";
import { calculateBpjs } from "./bpjs-calculator";
import { calculatePph21Ter } from "./pph21-ter-rates";
import { calculatePph21Progressive } from "./pph21-progressive";
import { countWeekdays } from "@/lib/leave-helpers";
import type { PtkpStatus } from "@prisma/client";

interface GenerateResult {
  periodId: string;
  totalEmployees: number;
  totalGrossAmount: number;
  totalNetAmount: number;
}

interface PayslipItemInput {
  salaryComponentId: string | null;
  name: string;
  type: "earning" | "deduction";
  amount: number;
  sortOrder: number;
}

export async function generatePayrollForPeriod(
  month: number,
  year: number,
  generatedBy: string,
): Promise<GenerateResult> {
  // 1. Check existing period
  const existing = await db.payrollPeriod.findUnique({
    where: { month_year: { month, year } },
    select: { id: true, status: true },
  });

  if (existing) {
    if (existing.status === "finalized" || existing.status === "paid") {
      throw new Error("Periode ini sudah difinalisasi dan tidak bisa di-generate ulang.");
    }
    // Delete existing draft or stuck processing period before recreating
    await db.payrollPeriod.delete({ where: { id: existing.id } });
  }

  // 2. Get settings
  const settings = await db.payrollSettings.findFirst();
  if (!settings) throw new Error("Payroll settings belum dikonfigurasi.");

  // 3. Create period — catch P2002 so concurrent requests don't leave a stuck "processing" period
  let period;
  try {
    period = await db.payrollPeriod.create({
      data: { month, year, status: "processing", generatedBy, generatedAt: new Date() },
    });
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      throw new Error("Payroll untuk periode ini sedang dalam proses generate. Tunggu sebentar dan coba lagi.");
    }
    throw e;
  }

  // 4. Get active employees
  const employees = await db.profile.findMany({
    where: { status: "active" },
    select: {
      id: true,
      fullName: true,
      employeeNumber: true,
      npwp: true,
      ptkpStatus: true,
      bankName: true,
      bankAccountNumber: true,
      bankAccountHolder: true,
      departmentId: true,
      positionId: true,
      department: { select: { name: true } },
      position: { select: { name: true } },
      joinDate: true,
    },
  });

  // 5. Date range for the month
  const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const endOfMonth = new Date(Date.UTC(year, month, 0));
  const totalWorkDays = countWeekdays(startOfMonth, endOfMonth);

  // Convert Decimal settings to numbers
  const bpjsRates = {
    bpjsKesCompanyRate: Number(settings.bpjsKesCompanyRate),
    bpjsKesEmployeeRate: Number(settings.bpjsKesEmployeeRate),
    bpjsKesMaxSalary: Number(settings.bpjsKesMaxSalary),
    jhtCompanyRate: Number(settings.jhtCompanyRate),
    jhtEmployeeRate: Number(settings.jhtEmployeeRate),
    jkkRate: Number(settings.jkkRate),
    jkmRate: Number(settings.jkmRate),
    jpCompanyRate: Number(settings.jpCompanyRate),
    jpEmployeeRate: Number(settings.jpEmployeeRate),
    jpMaxSalary: Number(settings.jpMaxSalary),
  };
  const absencePerDay = Number(settings.absenceDeductionPerDay);
  const latePerIncident = Number(settings.lateDeductionPerIncident);
  const pph21Method = settings.pph21Method;

  let periodGross = 0;
  let periodNet = 0;

  // 6. Process each employee
  for (const emp of employees) {
    // Get salary components
    const salaries = await db.employeeSalary.findMany({
      where: {
        profileId: emp.id,
        effectiveDate: { lte: endOfMonth },
        OR: [{ endDate: null }, { endDate: { gte: startOfMonth } }],
      },
      include: { salaryComponent: true },
    });

    // Get attendance summary
    const attendances = await db.attendance.findMany({
      where: { profileId: emp.id, date: { gte: startOfMonth, lte: endOfMonth } },
      select: { status: true },
    });

    const totalPresent = attendances.filter(
      (a) => a.status === "on_time" || a.status === "late",
    ).length;
    const totalLate = attendances.filter((a) => a.status === "late").length;
    const totalLeave = attendances.filter((a) => a.status === "on_leave").length;
    const totalAbsent = Math.max(0, totalWorkDays - totalPresent - totalLeave);

    // Calculate earnings
    let totalEarnings = 0;
    const earningItems: PayslipItemInput[] = [];
    const deductionItems: PayslipItemInput[] = [];

    let gajiPokok = 0;

    for (const sal of salaries) {
      const amount = Number(sal.amount);
      if (sal.salaryComponent.type === "earning") {
        totalEarnings += amount;
        earningItems.push({
          salaryComponentId: sal.salaryComponentId,
          name: sal.salaryComponent.name,
          type: "earning",
          amount,
          sortOrder: sal.salaryComponent.sortOrder,
        });
        if (sal.salaryComponent.code === "basic_salary") {
          gajiPokok = amount;
        }
      } else {
        deductionItems.push({
          salaryComponentId: sal.salaryComponentId,
          name: sal.salaryComponent.name,
          type: "deduction",
          amount,
          sortOrder: sal.salaryComponent.sortOrder,
        });
      }
    }

    // Attendance deductions
    const absenceDeduction = Math.round(totalAbsent * absencePerDay);
    const lateDeduction = Math.round(totalLate * latePerIncident);

    // BPJS
    const bpjs = calculateBpjs(gajiPokok, bpjsRates);

    // PPh 21
    const ptkpStatus = emp.ptkpStatus as PtkpStatus | null;
    let pph21Amount = 0;
    if (ptkpStatus && totalEarnings > 0) {
      if (pph21Method === "ter") {
        pph21Amount = calculatePph21Ter(totalEarnings, ptkpStatus);
      } else {
        pph21Amount = calculatePph21Progressive(
          totalEarnings,
          ptkpStatus,
          bpjs.jhtEmployee,
          bpjs.jpEmployee,
        );
      }
    }

    // Total deductions
    const componentDeductions = deductionItems.reduce((sum, item) => sum + item.amount, 0);
    const totalDeductions =
      componentDeductions +
      bpjs.bpjsKesEmployee +
      bpjs.jhtEmployee +
      bpjs.jpEmployee +
      pph21Amount +
      absenceDeduction +
      lateDeduction;

    const netSalary = totalEarnings - totalDeductions;

    // Add auto-calculated items to deduction list
    if (bpjs.bpjsKesEmployee > 0) {
      deductionItems.push({
        salaryComponentId: null,
        name: "BPJS Kesehatan",
        type: "deduction",
        amount: bpjs.bpjsKesEmployee,
        sortOrder: 100,
      });
    }
    if (bpjs.jhtEmployee > 0) {
      deductionItems.push({
        salaryComponentId: null,
        name: "JHT Karyawan",
        type: "deduction",
        amount: bpjs.jhtEmployee,
        sortOrder: 101,
      });
    }
    if (bpjs.jpEmployee > 0) {
      deductionItems.push({
        salaryComponentId: null,
        name: "JP Karyawan",
        type: "deduction",
        amount: bpjs.jpEmployee,
        sortOrder: 102,
      });
    }
    if (pph21Amount > 0) {
      deductionItems.push({
        salaryComponentId: null,
        name: `PPh 21 (${pph21Method === "ter" ? "TER" : "Progresif"})`,
        type: "deduction",
        amount: pph21Amount,
        sortOrder: 103,
      });
    }
    if (absenceDeduction > 0) {
      deductionItems.push({
        salaryComponentId: null,
        name: "Potongan Absen",
        type: "deduction",
        amount: absenceDeduction,
        sortOrder: 104,
      });
    }
    if (lateDeduction > 0) {
      deductionItems.push({
        salaryComponentId: null,
        name: "Potongan Terlambat",
        type: "deduction",
        amount: lateDeduction,
        sortOrder: 105,
      });
    }

    // Create payslip
    const payslip = await db.payslip.create({
      data: {
        payrollPeriodId: period.id,
        profileId: emp.id,
        employeeName: emp.fullName ?? "",
        employeeNumber: emp.employeeNumber,
        departmentName: emp.department?.name ?? null,
        positionName: emp.position?.name ?? null,
        bankName: emp.bankName,
        bankAccountNumber: emp.bankAccountNumber,
        bankAccountHolder: emp.bankAccountHolder,
        npwp: emp.npwp,
        ptkpStatus: ptkpStatus,
        totalEarnings,
        totalDeductions,
        netSalary,
        pph21Method: pph21Method,
        pph21Amount,
        bpjsKesCompany: bpjs.bpjsKesCompany,
        bpjsKesEmployee: bpjs.bpjsKesEmployee,
        jhtCompany: bpjs.jhtCompany,
        jhtEmployee: bpjs.jhtEmployee,
        jkkAmount: bpjs.jkkAmount,
        jkmAmount: bpjs.jkmAmount,
        jpCompany: bpjs.jpCompany,
        jpEmployee: bpjs.jpEmployee,
        totalWorkDays,
        totalPresent,
        totalAbsent,
        totalLate,
        totalLeave,
        absenceDeduction,
        lateDeduction,
        status: "draft",
      },
    });

    // Create payslip items
    const allItems = [...earningItems, ...deductionItems];
    for (const item of allItems) {
      await db.payslipItem.create({
        data: {
          payslipId: payslip.id,
          salaryComponentId: item.salaryComponentId,
          name: item.name,
          type: item.type,
          amount: item.amount,
          sortOrder: item.sortOrder,
        },
      });
    }

    periodGross += totalEarnings;
    periodNet += netSalary;
  }

  // 7. Update period totals
  await db.payrollPeriod.update({
    where: { id: period.id },
    data: {
      status: "draft",
      totalEmployees: employees.length,
      totalGrossAmount: periodGross,
      totalNetAmount: periodNet,
    },
  });

  return {
    periodId: period.id,
    totalEmployees: employees.length,
    totalGrossAmount: periodGross,
    totalNetAmount: periodNet,
  };
}
