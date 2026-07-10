import { requirePermission } from "@/lib/permissions";
import { getVenues } from "@/lib/queries/venues";
import { WeddingIndicatorForm } from "@/components/shared/wedding-indicators/WeddingIndicatorForm";

export default async function CreateWeddingIndicatorPage() {
  const { session, error } = await requirePermission({
    module: "vendor-specialist",
    action: "create",
  });

  if (error || !session) {
    return null;
  }

  const allVenues = await getVenues();
  const venues = allVenues.map((v) => ({ id: v.id, name: v.name }));

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
