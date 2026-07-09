import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Buildings2, ArrowRight } from "@solar-icons/react";

interface VenueFolder {
  venueId: string;
  venueName: string;
  count: number;
}

interface VenueFolderGridProps {
  folders: VenueFolder[];
}

export function VenueFolderGrid({ folders }: VenueFolderGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {folders.map((folder) => (
        <Link
          key={folder.venueId}
          href={`/dashboard/vendor-specialist/wedding-indicators?view=table&venueId=${folder.venueId}`}
        >
          <Card className="group cursor-pointer p-6 rounded-2xl hover:shadow-md transition-shadow">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Buildings2 weight="BoldDuotone" className="h-5 w-5 text-primary" />
                  <h3 className="font-heading text-lg font-semibold text-foreground">
                    {folder.venueName}
                  </h3>
                </div>
                <ArrowRight weight="BoldDuotone" className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              <div className="text-center py-4">
                <p className="font-heading text-3xl font-bold text-primary">
                  {folder.count}
                </p>
                <p className="text-xs text-muted-foreground mt-1">kuesioner</p>
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
