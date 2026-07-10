import { Card } from "@/components/ui/card";

interface SignaturesSectionProps {
  signatures: Record<string, string | Record<string, unknown> | null> | null;
  signatureNames: Record<string, string> | null;
  signatureDate: string | null;
}

const SIGNATURE_LABELS: Record<string, string> = {
  pasangan: "Pasangan",
  manager_pm: "Manager PM",
  manager_event: "Manager Event",
  general_manager: "General Manager",
  director_finance: "Director Finance",
  operational_director: "Operational Director",
};

const SIGNATURE_ORDER = [
  "pasangan",
  "manager_event",
  "manager_pm",
  "general_manager",
  "director_finance",
  "operational_director",
];

export function SignaturesSection({
  signatures,
  signatureNames,
  signatureDate,
}: SignaturesSectionProps) {
  if (!signatures) return null;

  const hasAnySignature = SIGNATURE_ORDER.some((key) => {
    const sig = signatures[key];
    return typeof sig === "string" && sig.startsWith("data:image");
  });

  if (!hasAnySignature) return null;

  return (
    <div className="space-y-4 rounded-2xl bg-card p-5 border print:break-before-page">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-lg font-semibold text-foreground">
          Tanda Tangan
        </h3>
        {signatureDate && (
          <p className="text-sm text-muted-foreground">
            Tanggal:{" "}
            {new Date(signatureDate).toLocaleDateString("id-ID", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
        {SIGNATURE_ORDER.map((key) => {
          const sig = signatures[key];
          const name = signatureNames?.[key] || "";
          const isValidImage =
            typeof sig === "string" && sig.startsWith("data:image");

          if (!isValidImage && !name) return null;

          return (
            <Card key={key} className="rounded-xl p-4 text-center space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                {SIGNATURE_LABELS[key] || key}
              </p>

              {isValidImage ? (
                <div className="flex items-center justify-center min-h-20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sig}
                    alt={`Tanda tangan ${SIGNATURE_LABELS[key] || key}`}
                    className="max-h-24 max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center min-h-20">
                  <p className="text-sm text-muted-foreground italic">
                    Belum ditandatangani
                  </p>
                </div>
              )}

              {name && (
                <p className="text-sm font-medium text-foreground border-t pt-2">
                  {name}
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
