"use client";

import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { JobPostingDetail } from "@/lib/queries/jobPostings";

export type CandidateSheetRow =
  NonNullable<NonNullable<JobPostingDetail>["candidates"]>[number];

const STAGE_LABELS: Record<string, string> = {
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  assessment: "Assessment",
  offering: "Offering",
  hired: "Hired",
  rejected: "Rejected",
};

function stageBadgeVariant(stage: string): "default" | "secondary" | "destructive" {
  if (stage === "hired") return "default";
  if (stage === "rejected") return "destructive";
  return "secondary";
}

function formatCurrency(value: { toString(): string } | null | undefined): string {
  if (value === null || value === undefined) return "-";
  const numeric = Number(value.toString());
  if (Number.isNaN(numeric)) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(numeric);
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function FilePreview({ label, url }: { label: string; url: string | null }) {
  if (!url) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <p className="text-sm italic text-muted-foreground">Tidak ada file</p>
      </div>
    );
  }

  const rawExt = url.split("?")[0].split(".").pop() ?? "";
  const ext = rawExt.toLowerCase();
  const isImage = ["jpg", "jpeg", "png", "webp", "gif", "heic"].includes(ext);
  const isPdf = ext === "pdf";

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {isImage ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={url}
            alt={label}
            className="max-h-56 w-full rounded-xl border border-border bg-muted/20 object-contain"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Klik gambar untuk buka ukuran penuh
          </p>
        </a>
      ) : isPdf ? (
        <div className="flex flex-col gap-1.5">
          <embed
            src={url}
            type="application/pdf"
            className="h-64 w-full rounded-xl border border-border"
          />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary underline underline-offset-4 hover:text-foreground"
          >
            Buka / unduh PDF
          </a>
        </div>
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
        >
          Unduh {label}
        </a>
      )}
    </div>
  );
}

export function CandidateDetailSheet({
  candidate,
  onClose,
}: {
  candidate: CandidateSheetRow | null;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={!!candidate}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent side="right" className="flex flex-col gap-0 overflow-y-auto p-0">
        <SheetHeader className="border-b border-border px-6 py-4">
          <div className="flex items-center gap-2 pr-8">
            <SheetTitle className="truncate">
              {candidate?.fullName ?? "Detail Kandidat"}
            </SheetTitle>
            {candidate && (
              <Badge
                variant={stageBadgeVariant(candidate.stage)}
                className="shrink-0 rounded-full"
              >
                {STAGE_LABELS[candidate.stage] ?? candidate.stage}
              </Badge>
            )}
          </div>
        </SheetHeader>

        {candidate && (
          <div className="flex flex-col gap-6 overflow-y-auto px-6 py-5">
            {/* Info pelamar */}
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Informasi Pelamar
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">Email</span>
                  <span className="break-all text-sm text-foreground">{candidate.email}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">No. HP</span>
                  <span className="text-sm text-foreground">{candidate.phoneNumber ?? "-"}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">Agama</span>
                  <span className="text-sm text-foreground">{candidate.religion ?? "-"}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">Gaji Diharapkan</span>
                  <span className="text-sm text-foreground">
                    {formatCurrency(candidate.expectedSalary)}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">Tanggal Daftar</span>
                  <span className="text-sm text-foreground">{formatDate(candidate.createdAt)}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Dokumen & Foto */}
            <div className="flex flex-col gap-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Dokumen & Foto
              </p>
              <FilePreview label="CV / Resume" url={candidate.resumeUrl} />
              <FilePreview label="Foto Pelamar" url={candidate.photoUrl} />
              <FilePreview label="Foto KTP" url={candidate.ktpPhotoUrl} />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
