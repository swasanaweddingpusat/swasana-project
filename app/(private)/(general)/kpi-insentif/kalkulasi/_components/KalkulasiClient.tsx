"use client";

import { ChartSquare, PieChart } from "@solar-icons/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SimulasiClient } from "../../simulasi/_components/SimulasiClient";
import { LaporanClient } from "../../laporan/_components/LaporanClient";

export function KalkulasiClient() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="simulasi">
        <TabsList className="flex h-auto w-full flex-wrap gap-1 rounded-2xl p-1">
          <TabsTrigger value="simulasi" className="rounded-xl gap-2">
            <ChartSquare weight="BoldDuotone" className="h-4 w-4" />
            Simulasi & Rekonsiliasi
          </TabsTrigger>
          <TabsTrigger value="laporan" className="rounded-xl gap-2">
            <PieChart weight="BoldDuotone" className="h-4 w-4" />
            Laporan Final
          </TabsTrigger>
        </TabsList>
        <TabsContent value="simulasi">
          <SimulasiClient />
        </TabsContent>
        <TabsContent value="laporan">
          <LaporanClient />
        </TabsContent>
      </Tabs>
    </div>
  );
}
