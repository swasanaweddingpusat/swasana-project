"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TagPrice, CupStar, ClipboardList, WalletMoney } from "@solar-icons/react";
import { TargetItemClient } from "../../target-item/_components/TargetItemClient";
import { AchievementClient } from "../../achievement/_components/AchievementClient";
import { KpiMasterClient } from "../../kpi-master/_components/KpiMasterClient";
import { CommissionPolicyClient } from "./CommissionPolicyClient";
import type {
  TargetItemRow,
  AchievementSchemaRow,
  KpiMasterRow,
  CommissionPolicyRow,
} from "@/lib/queries/kpiInsentif";

interface KonfigurasiClientProps {
  initialItems: TargetItemRow[];
  initialSchemas: AchievementSchemaRow[];
  initialMasters: KpiMasterRow[];
  initialPolicies: CommissionPolicyRow[];
}

export function KonfigurasiClient({
  initialItems,
  initialSchemas,
  initialMasters,
  initialPolicies,
}: KonfigurasiClientProps) {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="target-item">
        <TabsList className="flex h-auto w-full flex-wrap gap-1 rounded-2xl p-1">
          <TabsTrigger value="target-item" className="rounded-xl gap-2">
            <TagPrice weight="BoldDuotone" className="h-4 w-4" />
            Target Item
          </TabsTrigger>
          <TabsTrigger value="achievement" className="rounded-xl gap-2">
            <CupStar weight="BoldDuotone" className="h-4 w-4" />
            Skema Achievement
          </TabsTrigger>
          <TabsTrigger value="kpi-master" className="rounded-xl gap-2">
            <ClipboardList weight="BoldDuotone" className="h-4 w-4" />
            Master KPI
          </TabsTrigger>
          <TabsTrigger value="commission-policy" className="rounded-xl gap-2">
            <WalletMoney weight="BoldDuotone" className="h-4 w-4" />
            Komisi & Bonus Lanjutan
          </TabsTrigger>
        </TabsList>
        <TabsContent value="target-item">
          <TargetItemClient initialItems={initialItems} />
        </TabsContent>
        <TabsContent value="achievement">
          <AchievementClient initialSchemas={initialSchemas} />
        </TabsContent>
        <TabsContent value="kpi-master">
          <KpiMasterClient initialMasters={initialMasters} />
        </TabsContent>
        <TabsContent value="commission-policy">
          <CommissionPolicyClient initialPolicies={initialPolicies} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
