import { requirePermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { WeddingIndicatorForm } from "@/components/shared/wedding-indicators/WeddingIndicatorForm";

export default async function CreateWeddingIndicatorPage() {
  const { session, error } = await requirePermission({
    module: "vendor-specialist",
    action: "create",
  });

  if (error || !session) {
    return null;
  }

  const venues = await db.venue.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-heading text-3xl font-bold text-foreground">
          Buat Kuesioner Pernikahan
        </h1>
        <p className="text-muted-foreground mt-2">
          Isi form berikut untuk membuat kuesioner penilaian kepuasan pernikahan
        </p>
      </div>

      <WeddingIndicatorForm mode="create" venues={venues} />
    </div>
  );
}
