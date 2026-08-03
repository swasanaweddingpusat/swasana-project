"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CalendarDate, MapPoint, ClockCircle, UsersGroupRounded, Pen, Settings } from "@solar-icons/react";
import { AttendanceFilter } from "./AttendanceFilter";
import { AttendanceTable } from "./AttendanceTable";
import { WorkLocationManager } from "./WorkLocationManager";
import { WorkShiftManager } from "./WorkShiftManager";
import { WorkAssignmentManager } from "./WorkAssignmentManager";
import { ShiftOverrideManager } from "./ShiftOverrideManager";
import { AttendanceSettingsPanel } from "./AttendanceSettingsPanel";
import { GlobalSettingsPanel } from "./GlobalSettingsPanel";

export function AttendanceManagement() {
  return (
    <Tabs defaultValue="rekap">
      <TabsList className="flex h-auto w-full flex-wrap gap-1 rounded-2xl p-1">
        <TabsTrigger value="rekap" className="rounded-xl gap-2">
          <CalendarDate weight="BoldDuotone" className="h-4 w-4" />
          Rekap Kehadiran
        </TabsTrigger>
        <TabsTrigger value="lokasi" className="rounded-xl gap-2">
          <MapPoint weight="BoldDuotone" className="h-4 w-4" />
          Lokasi Kerja
        </TabsTrigger>
        <TabsTrigger value="shift" className="rounded-xl gap-2">
          <ClockCircle weight="BoldDuotone" className="h-4 w-4" />
          Shift Kerja
        </TabsTrigger>
        <TabsTrigger value="assignment" className="rounded-xl gap-2">
          <UsersGroupRounded weight="BoldDuotone" className="h-4 w-4" />
          Assignment
        </TabsTrigger>
        <TabsTrigger value="override" className="rounded-xl gap-2">
          <Pen weight="BoldDuotone" className="h-4 w-4" />
          Override Shift
        </TabsTrigger>
        <TabsTrigger value="settings" className="rounded-xl gap-2">
          <Settings weight="BoldDuotone" className="h-4 w-4" />
          Pengaturan
        </TabsTrigger>
      </TabsList>
      <TabsContent value="rekap" className="space-y-6">
        <AttendanceFilter />
        <AttendanceTable />
      </TabsContent>
      <TabsContent value="lokasi">
        <WorkLocationManager />
      </TabsContent>
      <TabsContent value="shift">
        <WorkShiftManager />
      </TabsContent>
      <TabsContent value="assignment">
        <WorkAssignmentManager />
      </TabsContent>
      <TabsContent value="override">
        <ShiftOverrideManager />
      </TabsContent>
      <TabsContent value="settings" className="space-y-4">
        <AttendanceSettingsPanel />
        <GlobalSettingsPanel />
      </TabsContent>
    </Tabs>
  );
}
