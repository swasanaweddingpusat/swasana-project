import { Suspense } from "react";
import { requirePermission } from "@/lib/permissions";
import {
  getWeddingIndicators,
  getWeddingIndicatorsByVenue,
} from "@/lib/queries/weddingIndicators";
import { getVenues } from "@/lib/queries/venues";
import Link from "next/link";
import { VenueFolderGrid } from "@/components/shared/wedding-indicators/VenueFolderGrid";
import { IndicatorListTable } from "@/components/shared/wedding-indicators/IndicatorListTable";
import { Button } from "@/components/ui/button";

export default async function WeddingIndicatorsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    search?: string;
    venueId?: string;
    page?: string;
  }>;
}) {
  const { session, error } = await requirePermission({
    module: "vendor-specialist",
    action: "view",
  });

  if (error || !session) {
    return null;
  }

  const params = await searchParams;
  const view = params.view || "folder";
  const page = parseInt(params.page || "1");
  const search = params.search;
  const venueId = params.venueId;

  const allVenues = await getVenues();
  const venues = allVenues.map((v) => ({ id: v.id, name: v.name }));

  let indicators: Awaited<ReturnType<typeof getWeddingIndicators>>["data"] = [];
  let venueFolders: Awaited<ReturnType<typeof getWeddingIndicatorsByVenue>> =
    [];

  if (view === "table") {
    const result = await getWeddingIndicators({
      page,
      limit: 10,
      search,
      venueId,
    });
    indicators = result.data;
  } else {
    venueFolders = await getWeddingIndicatorsByVenue();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">
            Indikator Pernikahan
          </h1>
          <p className="text-muted-foreground mt-2">
            Kelola kuesioner penilaian kepuasan pasangan pernikahan
          </p>
        </div>
        <div className="flex items-center gap-2">
          {view === "table" && (
            <Link href="/dashboard/vendor-specialist/wedding-indicators">
              <Button variant="outline" size="sm">
                Tampilan Folder
              </Button>
            </Link>
          )}
          {view === "folder" && (
            <Link href="/dashboard/vendor-specialist/wedding-indicators?view=table">
              <Button variant="outline" size="sm">
                Tampilan Tabel
              </Button>
            </Link>
          )}
          <Link href="/dashboard/vendor-specialist/wedding-indicators/create">
            <Button size="sm">Buat Kuesioner</Button>
          </Link>
        </div>
      </div>

      <div className="space-y-6">
        {view === "folder" && venueFolders.length > 0 ? (
          <VenueFolderGrid folders={venueFolders} />
        ) : (
          <Suspense
            fallback={
              <div className="rounded-2xl border py-12 text-center text-sm text-muted-foreground">
                Memuat data...
              </div>
            }
          >
            <IndicatorListTable
              indicators={indicators}
              venues={venues}
              canCreate={false}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
