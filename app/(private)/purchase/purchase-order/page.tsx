import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getBookings } from "@/lib/queries/bookings";
import { requirePagePermission } from "@/lib/require-page-permission";
import { VendorSpecialistClient } from "./_components/VendorSpecialistClient";
import { cn } from "@/lib/utils";
import type { DataScope } from "@/types/user";

export const metadata: Metadata = {
  title: "Vendor Specialist",
  description: "Kelola set vendor, catering, dan dekorasi",
};

export default async function VendorSpecialistPage() {
  await requirePagePermission("vendor-specialist");

  const session = await auth();
  const profileId = session?.user?.profileId ?? undefined;
  let dataScope: DataScope = "own";

  if (profileId) {
    const profile = await db.profile.findUnique({
      where: { id: profileId },
      select: { dataScope: true },
    });
    if (profile) dataScope = profile.dataScope as DataScope;
  }

  const bookings = await getBookings(profileId, dataScope, { category: "WEDDINGS" });

  return (
    <div className={cn("flex", "flex-col", "mb-6", "px-2")}>
      <VendorSpecialistClient initialData={bookings} />
    </div>
  );
}
