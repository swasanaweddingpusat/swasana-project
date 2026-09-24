import type { Metadata } from "next";
import type { JSX } from "react";
import { connection } from "next/server";
import { requirePagePermission } from "@/lib/require-page-permission";
import { getAiProviders } from "@/lib/queries/aiProviders";
import { AiModelManager } from "./_components/AiModelManager";

export const metadata: Metadata = { title: "AI Model" };

export default async function AiModelSettingsPage(): Promise<JSX.Element> {
  await requirePagePermission("settings-ai-model");
  await connection();

  const providers = await getAiProviders();

  return (
    <div className="px-6 pb-6">
      <AiModelManager initialProviders={providers} />
    </div>
  );
}
