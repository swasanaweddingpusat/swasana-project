"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowRight } from "@solar-icons/react";
import { useRouter } from "next/navigation";

interface Indicator {
  id: string;
  coupleName: string;
  eventDate: Date;
  venue: { id: string; name: string };
  satisfactionScore: number | null;
  allowancePercentage: number | null;
  allowanceNominal: number | null;
}

interface IndicatorListTableProps {
  indicators: Indicator[];
}

export function IndicatorListTable({
  indicators,
}: IndicatorListTableProps): React.ReactElement {
  const router = useRouter();

  const formatScore = (score: number | null) => {
    if (score === null) return "–";
    return score.toFixed(1);
  };

  const formatNominal = (nominal: number | null) => {
    if (nominal === null) return "–";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(nominal);
  };

  return (
    <div className="rounded-2xl border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Nama Pasangan</TableHead>
            <TableHead>Venue</TableHead>
            <TableHead>Tanggal Acara</TableHead>
            <TableHead className="text-right">Skor Kepuasan</TableHead>
            <TableHead className="text-right">Tunjangan</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {indicators.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8">
                <p className="text-muted-foreground">
                  Belum ada kuesioner pernikahan
                </p>
              </TableCell>
            </TableRow>
          ) : (
            indicators.map((indicator) => (
              <TableRow
                key={indicator.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() =>
                  router.push(
                    `/general/wedding-indicators/${indicator.id}`,
                  )
                }
              >
                <TableCell className="font-medium">
                  {indicator.coupleName}
                </TableCell>
                <TableCell>{indicator.venue.name}</TableCell>
                <TableCell>
                  {new Date(indicator.eventDate).toLocaleDateString("id-ID")}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatScore(indicator.satisfactionScore)}
                </TableCell>
                <TableCell className="text-right">
                  {indicator.allowancePercentage !== null &&
                    indicator.allowancePercentage !== undefined && (
                      <span className="text-sm">
                        {indicator.allowancePercentage}% (
                        {formatNominal(indicator.allowanceNominal)})
                      </span>
                    )}
                  {(indicator.allowancePercentage === null ||
                    indicator.allowancePercentage === undefined) &&
                    "–"}
                </TableCell>
                <TableCell className="text-right">
                  <ArrowRight
                    weight="BoldDuotone"
                    className="h-5 w-5 text-muted-foreground"
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
