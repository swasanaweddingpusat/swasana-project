"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/use-permissions";
import { CalendarDate, DocumentText, UsersGroupRounded, Settings } from "@solar-icons/react";
import { PayrollPeriodTable } from "./PayrollPeriodTable";
import { SalaryComponentManager } from "./SalaryComponentManager";
import { EmployeeSalaryManager } from "./EmployeeSalaryManager";
import { PayrollSettingsPanel } from "./PayrollSettingsPanel";

export function PayrollManagement() {
  const { can } = usePermissions();

  const showSettings = can("hr-payroll", "edit");

  return (
    <Tabs defaultValue="periods">
      <TabsList className="flex h-auto w-full flex-col gap-1 rounded-2xl p-1 sm:grid sm:grid-cols-4 sm:gap-0">
        <TabsTrigger value="periods" className="rounded-xl gap-2">
          <CalendarDate weight="BoldDuotone" className="h-4 w-4" />
          Periode Payroll
        </TabsTrigger>
        <TabsTrigger value="components" className="rounded-xl gap-2">
          <DocumentText weight="BoldDuotone" className="h-4 w-4" />
          Komponen Gaji
        </TabsTrigger>
        <TabsTrigger value="salaries" className="rounded-xl gap-2">
          <UsersGroupRounded weight="BoldDuotone" className="h-4 w-4" />
          Gaji Karyawan
        </TabsTrigger>
        {showSettings && (
          <TabsTrigger value="settings" className="rounded-xl gap-2">
            <Settings weight="BoldDuotone" className="h-4 w-4" />
            Pengaturan
          </TabsTrigger>
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
