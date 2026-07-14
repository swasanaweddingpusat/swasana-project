import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { PengembanganSdmClient } from "./_components/PengembanganSdmClient";

export const metadata: Metadata = { title: "Pengembangan SDM" };

export default async function PengembanganSdmPage() {
  await requirePagePermission("hr");
  return <PengembanganSdmClient />;
}
