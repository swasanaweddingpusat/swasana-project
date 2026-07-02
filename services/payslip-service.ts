import type { MyPayslipItem, PayslipDetail } from "@/lib/queries/payslips";

export async function fetchMyPayslips(): Promise<MyPayslipItem[]> {
  const res = await fetch("/api/hr/payslips/my");
  if (!res.ok) throw new Error("Failed to fetch payslips");
  return res.json() as Promise<MyPayslipItem[]>;
}

export async function fetchPayslipById(id: string): Promise<PayslipDetail> {
  const res = await fetch(`/api/hr/payslips/${id}`);
  if (!res.ok) throw new Error("Failed to fetch payslip");
  return res.json() as Promise<PayslipDetail>;
}
