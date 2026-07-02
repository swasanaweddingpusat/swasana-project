"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
      <TabsList className="mb-4">
        <TabsTrigger value="rekap">Rekap Kehadiran</TabsTrigger>
        <TabsTrigger value="lokasi">Lokasi Kerja</TabsTrigger>
        <TabsTrigger value="shift">Shift Kerja</TabsTrigger>
        <TabsTrigger value="assignment">Assignment</TabsTrigger>
        <TabsTrigger value="override">Override Shift</TabsTrigger>
        <TabsTrigger value="settings">Pengaturan</TabsTrigger>
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
