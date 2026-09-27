"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ClipboardList, ClipboardCheck } from "@solar-icons/react";
import { AttendanceCorrectionQueue } from "./AttendanceCorrectionQueue";
import { WorkTypeApprovalQueue } from "./WorkTypeApprovalQueue";

export function KoreksiAbsenTabs() {
  return (
    <Tabs defaultValue="koreksi">
      <TabsList className="flex h-auto w-full flex-wrap gap-1 rounded-2xl p-1">
        <TabsTrigger value="koreksi" className="rounded-xl gap-2">
          <ClipboardList weight="BoldDuotone" className="h-4 w-4" />
          Koreksi Absen
        </TabsTrigger>
        <TabsTrigger value="wfh-wfa" className="rounded-xl gap-2">
          <ClipboardCheck weight="BoldDuotone" className="h-4 w-4" />
          Persetujuan WFH/WFA
        </TabsTrigger>
      </TabsList>
      <TabsContent value="koreksi">
        <AttendanceCorrectionQueue />
      </TabsContent>
      <TabsContent value="wfh-wfa">
        <WorkTypeApprovalQueue />
      </TabsContent>
    </Tabs>
  );
}
