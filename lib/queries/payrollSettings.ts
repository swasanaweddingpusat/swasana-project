import { db } from "@/lib/db";

export async function getPayrollSettings() {
  return db.payrollSettings.findFirst();
}

export type PayrollSettingsResult = Awaited<ReturnType<typeof getPayrollSettings>>;
