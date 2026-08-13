"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CalendarDate, UsersGroupRounded, CheckCircle, ClipboardText, Wallet } from "@solar-icons/react";
import { usePermissions } from "@/hooks/use-permissions";
import { usePendingForManager } from "@/hooks/use-leave-requests";
import { LeaveBalanceCards } from "./LeaveBalanceCards";
import { LeaveRequestForm } from "./LeaveRequestForm";
import { LeaveRequestHistory } from "./LeaveRequestHistory";
import { LeaveTeamCalendar } from "./LeaveTeamCalendar";
import { LeaveApprovalTable } from "./LeaveApprovalTable";
import { LeaveTypeManager } from "./LeaveTypeManager";
import { LeaveBalanceManager } from "./LeaveBalanceManager";

interface LeaveManagementProps {
  mode?: "self-service" | "hr";
}

export function LeaveManagement({ mode = "hr" }: LeaveManagementProps) {
  const { can } = usePermissions();
  const { data: pendingRequests } = usePendingForManager();

  if (mode === "self-service") {
    return (
      <div className="space-y-6">
        <LeaveBalanceCards />
        <LeaveRequestForm />
        <LeaveRequestHistory />
      </div>
    );
  }

  const showApproval =
    (pendingRequests && pendingRequests.length > 0) ||
    can("hr-leave", "approve");
  const showLeaveTypes =
    can("hr-leave", "create") || can("hr-leave", "edit");
  const showBalanceManager = can("hr-leave", "edit");

  return (
    <Tabs defaultValue="my-leave">
      <TabsList className="flex h-auto w-full flex-wrap gap-1 rounded-2xl p-1">
        <TabsTrigger value="my-leave" className="rounded-xl gap-2">
          <CalendarDate weight="BoldDuotone" className="h-4 w-4" />
          Cuti Saya
        </TabsTrigger>
        <TabsTrigger value="calendar" className="rounded-xl gap-2">
          <UsersGroupRounded weight="BoldDuotone" className="h-4 w-4" />
          Kalender Tim
        </TabsTrigger>
        {showApproval && (
          <TabsTrigger value="approval" className="rounded-xl gap-2">
            <CheckCircle weight="BoldDuotone" className="h-4 w-4" />
            Approval
          </TabsTrigger>
        )}
        {showLeaveTypes && (
          <TabsTrigger value="types" className="rounded-xl gap-2">
            <ClipboardText weight="BoldDuotone" className="h-4 w-4" />
            Jenis Cuti
          </TabsTrigger>
        )}
        {showBalanceManager && (
          <TabsTrigger value="balances" className="rounded-xl gap-2">
            <Wallet weight="BoldDuotone" className="h-4 w-4" />
            Saldo
          </TabsTrigger>
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
