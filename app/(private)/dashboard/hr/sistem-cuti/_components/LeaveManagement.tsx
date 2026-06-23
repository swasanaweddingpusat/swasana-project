"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/use-permissions";
import { usePendingForManager } from "@/hooks/use-leave-requests";
import { LeaveBalanceCards } from "./LeaveBalanceCards";
import { LeaveRequestForm } from "./LeaveRequestForm";
import { LeaveRequestHistory } from "./LeaveRequestHistory";
import { LeaveTeamCalendar } from "./LeaveTeamCalendar";
import { LeaveApprovalTable } from "./LeaveApprovalTable";
import { LeaveTypeManager } from "./LeaveTypeManager";
import { LeaveBalanceManager } from "./LeaveBalanceManager";

export function LeaveManagement() {
  const { can } = usePermissions();
  const { data: pendingRequests } = usePendingForManager();

  const showApproval =
    (pendingRequests && pendingRequests.length > 0) ||
    can("hr-leave", "approve");
  const showLeaveTypes =
    can("hr-leave", "create") || can("hr-leave", "edit");
  const showBalanceManager = can("hr-leave", "edit");

  return (
    <Tabs defaultValue="my-leave">
      <TabsList className="mb-4 flex-wrap">
        <TabsTrigger value="my-leave">Cuti Saya</TabsTrigger>
        <TabsTrigger value="calendar">Kalender Tim</TabsTrigger>
        {showApproval && (
          <TabsTrigger value="approval">Approval</TabsTrigger>
        )}
        {showLeaveTypes && (
          <TabsTrigger value="types">Jenis Cuti</TabsTrigger>
        )}
        {showBalanceManager && (
          <TabsTrigger value="balances">Saldo</TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="my-leave" className="space-y-6">
        <LeaveBalanceCards />
        <LeaveRequestForm />
        <LeaveRequestHistory />
      </TabsContent>

      <TabsContent value="calendar">
        <LeaveTeamCalendar />
      </TabsContent>

      {showApproval && (
        <TabsContent value="approval">
          <LeaveApprovalTable />
        </TabsContent>
      )}

      {showLeaveTypes && (
        <TabsContent value="types">
          <LeaveTypeManager />
        </TabsContent>
      )}

      {showBalanceManager && (
        <TabsContent value="balances">
          <LeaveBalanceManager />
        </TabsContent>
      )}
    </Tabs>
  );
}
