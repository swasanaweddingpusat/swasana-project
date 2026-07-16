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
import { IndicatorFilterBar } from "@/components/shared/wedding-indicators/IndicatorFilterBar";
import { Button } from "@/components/ui/button";

export default async function WeddingIndicatorsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    search?: string;
    venueId?: string;
    page?: string;
    month?: string;
    year?: string;
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
  const month = params.month ? parseInt(params.month) : undefined;
  const year = params.year ? parseInt(params.year) : undefined;

  let dateFrom: Date | undefined;
  let dateTo: Date | undefined;
  if (year) {
    if (month) {
      dateFrom = new Date(year, month - 1, 1);
      dateTo = new Date(year, month, 0, 23, 59, 59, 999);
    } else {
      dateFrom = new Date(year, 0, 1);
      dateTo = new Date(year, 11, 31, 23, 59, 59, 999);
    }
  }

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
      dateFrom,
      dateTo,
    });
    indicators = result.data;
  } else {
    venueFolders = await getWeddingIndicatorsByVenue({ search, dateFrom, dateTo });
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

      <Suspense
        fallback={
          <div className="h-11 rounded-xl bg-muted/50 animate-pulse" />
        }
      >
        <IndicatorFilterBar venues={venues} />
      </Suspense>

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
            <IndicatorListTable indicators={indicators} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
