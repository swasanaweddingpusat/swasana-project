"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/use-permissions";
import { PayrollPeriodTable } from "./PayrollPeriodTable";
import { SalaryComponentManager } from "./SalaryComponentManager";
import { EmployeeSalaryManager } from "./EmployeeSalaryManager";
import { PayrollSettingsPanel } from "./PayrollSettingsPanel";

export function PayrollManagement() {
  const { can } = usePermissions();

  const showSettings = can("hr-payroll", "edit");

  return (
    <Tabs defaultValue="periods">
      <TabsList className="mb-4 flex-wrap">
        <TabsTrigger value="periods">Periode Payroll</TabsTrigger>
        <TabsTrigger value="components">Komponen Gaji</TabsTrigger>
        <TabsTrigger value="salaries">Gaji Karyawan</TabsTrigger>
        {showSettings && (
          <TabsTrigger value="settings">Pengaturan</TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="periods">
        <PayrollPeriodTable />
      </TabsContent>

      <TabsContent value="components">
        <SalaryComponentManager />
      </TabsContent>

      <TabsContent value="salaries">
        <EmployeeSalaryManager />
      </TabsContent>

      {showSettings && (
        <TabsContent value="settings">
          <PayrollSettingsPanel />
        </TabsContent>
      )}
    </Tabs>
  );
}
