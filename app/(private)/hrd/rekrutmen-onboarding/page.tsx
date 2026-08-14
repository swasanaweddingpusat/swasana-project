import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { RekrutmenOnboardingClient } from "./_components/RekrutmenOnboardingClient";

export const metadata: Metadata = {
  title: "Rekrutmen & Onboarding - SWASANA",
  description: "Kelola lowongan, kandidat, dan onboarding",
};

export default async function RekrutmenOnboardingPage() {
  await requirePagePermission("hr-recruitment");

  return (
    <div className="mb-6 flex w-full flex-col gap-6">
      <RekrutmenOnboardingClient />
    </div>
  );
}