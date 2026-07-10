"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  WeddingIndicatorForm,
  type QuestionnaireData,
} from "@/components/shared/wedding-indicators/WeddingIndicatorForm";
import { CheckCircle } from "@solar-icons/react";

interface IndicatorData {
  id: string;
  coupleName: string;
  eventDate: string;
  venueId: string;
  venueName: string;
  eventManagerName: string;
  eventManagerRating: number | null;
  eventManagerNotes: string;
  woName: string | null;
  woRating: number | null;
  woNotes: string;
  ballroomFacilitiesRating: number | null;
  ballroomFacilitiesNotes: string;
  ballroomCleanlinessRating: number | null;
  ballroomCleanlinessNotes: string;
  vendorsRating: number | null;
  vendorsNotes: string;
  salesRating: number | null;
  salesNotes: string;
  recommendationScore: number;
  satisfactionScore: number | null;
  allowancePercentage: number | null;
  allowanceNominal: number | null;
  projectManagers: Array<{ name: string; rating: number | null; notes: string }>;
  postWeddingWishes: Record<string, unknown> | null;
  notes: string;
  signatures: Record<string, string | null> | null;
  signatureNames: Record<string, string> | null;
  signatureDate: string;
}

function WeddingIndicatorPublicContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [accessCode, setAccessCode] = useState("");
  const [step, setStep] = useState<"code" | "form" | "done">("code");
  const [indicator, setIndicator] = useState<IndicatorData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="rounded-2xl border bg-card p-8 text-center max-w-md">
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Link Tidak Valid
          </h1>
          <p className="mt-2 text-muted-foreground">
            Link yang Anda akses tidak memiliki token yang valid.
          </p>
        </div>
      </div>
    );
  }

  async function handleValidate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/wedding-indicator-share/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, accessCode: accessCode.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Terjadi kesalahan");
        return;
      }

      setIndicator(data.indicator);
      setStep("form");
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  }

  if (step === "code") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border bg-card p-8">
          <div className="text-center mb-6">
            <h1 className="font-heading text-2xl font-bold text-foreground">
              Kuesioner Pernikahan
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Masukkan kode akses yang diberikan untuk mengakses kuesioner.
            </p>
          </div>

          <form onSubmit={handleValidate} className="space-y-4">
            <div>
              <Label htmlFor="accessCode" className="text-sm">
                Kode Akses
              </Label>
              <Input
                id="accessCode"
                type="text"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                placeholder="Masukkan 6 karakter"
                maxLength={6}
                className="mt-2 text-center font-mono text-2xl tracking-[0.3em] uppercase"
                autoFocus
                disabled={loading}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || accessCode.length < 6}
            >
              {loading ? "Memverifikasi..." : "Akses Kuesioner"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center">
          <CheckCircle
            weight="BoldDuotone"
            className="h-16 w-16 text-primary mx-auto mb-4"
          />
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Terima Kasih!
          </h1>
          <p className="mt-2 text-muted-foreground">
            Kuesioner berhasil disimpan.
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => setStep("form")}
          >
            Edit Kembali
          </Button>
        </div>
      </div>
    );
  }

  const initialData = indicator
    ? {
        id: indicator.id,
        coupleName: indicator.coupleName,
        eventDate:
          typeof indicator.eventDate === "string"
            ? indicator.eventDate.split("T")[0]
            : new Date(indicator.eventDate).toISOString().split("T")[0],
        venueId: indicator.venueId,
        eventManagerName: indicator.eventManagerName,
        eventManagerRating: indicator.eventManagerRating,
        eventManagerNotes: indicator.eventManagerNotes || "",
        woName: indicator.woName,
        woRating: indicator.woRating,
        woNotes: indicator.woNotes || "",
        ballroomFacilitiesRating: indicator.ballroomFacilitiesRating,
        ballroomFacilitiesNotes: indicator.ballroomFacilitiesNotes || "",
        ballroomCleanlinessRating: indicator.ballroomCleanlinessRating,
        ballroomCleanlinessNotes: indicator.ballroomCleanlinessNotes || "",
        vendorsRating: indicator.vendorsRating,
        vendorsNotes: indicator.vendorsNotes || "",
        salesRating: indicator.salesRating,
        salesNotes: indicator.salesNotes || "",
        recommendationScore: indicator.recommendationScore,
        questionnaireData: {
          projectManagers: indicator.projectManagers,
          postWeddingWishes: indicator.postWeddingWishes ?? undefined,
          signatures: indicator.signatures ?? undefined,
          signatureNames: indicator.signatureNames ?? undefined,
          signatureDate: indicator.signatureDate,
        } as QuestionnaireData,
        notes: indicator.notes || "",
        satisfactionScore: indicator.satisfactionScore,
        allowancePercentage: indicator.allowancePercentage,
        allowanceNominal: indicator.allowanceNominal,
      }
    : undefined;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="font-heading text-3xl font-bold text-foreground">
            Kuesioner Pernikahan
          </h1>
          {indicator && (
            <p className="mt-1 text-muted-foreground">
              {indicator.coupleName} — {indicator.venueName}
            </p>
          )}
        </div>

        <WeddingIndicatorForm
          mode="public"
          venues={[]}
          initialData={initialData}
          shareToken={token}
          shareAccessCode={accessCode}
          venueName={indicator?.venueName}
          onPublicSaveSuccess={() => setStep("done")}
        />
      </div>
    </div>
  );
}

export default function WeddingIndicatorPublicPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted-foreground">Memuat...</p>
        </div>
      }
    >
      <WeddingIndicatorPublicContent />
    </Suspense>
  );
}
