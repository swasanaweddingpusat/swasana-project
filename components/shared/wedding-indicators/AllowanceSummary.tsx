import { Card } from "@/components/ui/card";

interface AllowanceSummaryProps {
  satisfactionScore: number | null | undefined;
  allowancePercentage: number | null | undefined;
  allowanceNominal: number | null | undefined;
}

export function AllowanceSummary({
  satisfactionScore,
  allowancePercentage,
  allowanceNominal,
}: AllowanceSummaryProps) {
  const formattedNominal = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(allowanceNominal || 0);

  return (
    <Card className="rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 p-5">
      <div className="space-y-4">
        <h3 className="font-heading text-lg font-semibold text-foreground">
          Ringkasan Tunjangan
        </h3>

        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Skor Kepuasan</p>
            <p className="font-heading text-2xl font-bold text-primary mt-2">
              {satisfactionScore ? satisfactionScore.toFixed(1) : "–"}
            </p>
          </div>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">Persentase</p>
            <p className="font-heading text-2xl font-bold text-primary mt-2">
              {allowancePercentage !== null && allowancePercentage !== undefined
                ? `${allowancePercentage}%`
                : "–"}
            </p>
          </div>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">Nominal</p>
            <p className="font-heading text-lg font-bold text-primary mt-2">
              {allowanceNominal !== null && allowanceNominal !== undefined
                ? formattedNominal
                : "–"}
            </p>
          </div>
        </div>

        {satisfactionScore === null || satisfactionScore === undefined ? (
          <p className="text-xs text-muted-foreground text-center py-2 italic">
            Lengkapi rating untuk melihat kalkulasi tunjangan
          </p>
        ) : null}
      </div>
    </Card>
  );
}
