"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CalendarDate, UsersGroupRounded, CheckCircle, ClipboardText, Wallet, DocumentText, Ticket } from "@solar-icons/react";
import { usePermissions } from "@/hooks/use-permissions";
import { usePendingForManager } from "@/hooks/use-leave-requests";
import { LeaveBalanceCards } from "./LeaveBalanceCards";
import { LeaveRequestForm } from "./LeaveRequestForm";
import { LeaveRequestHistory } from "./LeaveRequestHistory";
import { LeaveTeamCalendar } from "./LeaveTeamCalendar";
import { LeaveApprovalTable } from "./LeaveApprovalTable";
import { LeaveTypeManager } from "./LeaveTypeManager";
import { LeaveBalanceManager } from "./LeaveBalanceManager";
import { HolidayTokenManager } from "./HolidayTokenManager";

interface LeaveManagementProps {
  mode?: "self-service" | "hr";
}

export function LeaveManagement({ mode = "hr" }: LeaveManagementProps) {
  const { can } = usePermissions();
  const { data: pendingRequests } = usePendingForManager();
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);

  if (mode === "self-service") {
    return (
      <div className="space-y-8">
        <LeaveBalanceCards />
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-heading text-xl font-semibold">Riwayat Pengajuan</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pantau status dan detail pengajuan cuti Anda.
              </p>
            </div>
            <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
              <DialogTrigger
                render={
                  <Button className="w-full rounded-xl sm:w-auto">
                    <DocumentText weight="BoldDuotone" className="h-4 w-4" />
                    Ajukan Cuti
                  </Button>
                }
              />
              <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto rounded-2xl p-0 sm:max-w-2xl">
                <DialogHeader className="border-b px-6 py-5 sm:px-7">
                  <DialogTitle className="font-heading text-xl">Ajukan Cuti</DialogTitle>
                  <DialogDescription>
                    Isi periode cuti dan alasan pengajuan Anda.
                  </DialogDescription>
                </DialogHeader>
                <LeaveRequestForm
                  inDialog
                  onSubmitted={() => setIsRequestDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
          <LeaveRequestHistory />
        </div>
      </div>
    );
  }

  const showApproval =
    (pendingRequests && pendingRequests.length > 0) ||
    can("hr-leave", "approve");
  const showLeaveTypes =
    can("hr-leave", "create") || can("hr-leave", "edit");
  const showBalanceManager = can("hr-leave", "edit");
  const showTokenManager =
    can("hr-leave", "create") || can("hr-leave", "edit");

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
        {showTokenManager && (
          <TabsTrigger value="tokens" className="rounded-xl gap-2">
            <Ticket weight="BoldDuotone" className="h-4 w-4" />
            Token Hari Besar
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

      {showTokenManager && (
        <TabsContent value="tokens">
          <HolidayTokenManager />
        </TabsContent>
      )}
    </Tabs>
  );
}
