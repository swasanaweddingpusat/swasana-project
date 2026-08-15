"use client";

import { CloseCircle, Link as LinkIcon, Phone, UserCircle, Bolt } from "@solar-icons/react";
import { Badge } from "@/components/ui/badge";
import type { Deal } from "./bitrix-deals-manager";

const lbl = "text-xs font-medium mb-1 text-muted-foreground";
const val = "text-sm font-normal text-foreground break-words";

// Pick a readable text color (near-black or near-white) for a Bitrix stage hex.
function contrastText(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return "#0f4159";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#0f4159" : "#ffffff";
}

function fmtMoney(value: number, currency: string): string {
  if (!value) return "-";
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: currency || "IDR",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("id-ID")}`;
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={lbl}>{label}</p>
      <p className={val}>{children}</p>
    </div>
  );
}

export function BitrixDealDetailModal({
  deal,
  onClose,
}: {
  deal: Deal | null;
  onClose: () => void;
}) {
  if (!deal) return null;

  return (
    <div className="fixed inset-0 z-[60] flex bg-black/40 sm:items-center sm:justify-center">
      <div className="bg-background w-full h-full flex flex-col sm:rounded-xl sm:shadow-lg sm:w-[70%] sm:max-w-[70%] overflow-hidden sm:h-auto sm:max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-start px-4 sm:px-8 py-4 border-b sticky top-0 bg-background z-10">
          <div className="flex items-start gap-3 flex-1 pr-4 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent">
              <Bolt weight="BoldDuotone" className="h-5 w-5 text-foreground" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold truncate">{deal.title}</h2>
              <p className="text-xs text-muted-foreground">Transaksi #{deal.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 h-9 w-9 sm:h-11 sm:w-11 rounded-full flex items-center justify-center cursor-pointer bg-destructive/10 hover:bg-destructive/20 transition-colors"
            aria-label="Close"
          >
            <CloseCircle weight="BoldDuotone" className="h-5 w-5 sm:h-6 sm:w-6 text-destructive" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-4 sm:px-8 py-6">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <Badge
              className="rounded-full font-medium"
              style={
                deal.stageColor
                  ? { backgroundColor: deal.stageColor, color: contrastText(deal.stageColor) }
                  : undefined
              }
            >
              {deal.stage}
            </Badge>
            <Badge variant="outline" className="rounded-full font-normal">
              {deal.pipeline}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-5 text-sm">
            {/* Col 1 — Klien & kontak */}
            <div className="space-y-4">
              <Field label="Nama Client">{deal.client ?? "-"}</Field>
              <Field label="Telepon">
                {deal.phone ? (
                  <a href={`tel:${deal.phone}`} className="inline-flex items-center gap-1.5 text-foreground hover:underline">
                    <Phone weight="BoldDuotone" className="h-3.5 w-3.5 text-muted-foreground" />
                    {deal.phone}
                  </a>
                ) : (
                  "-"
                )}
              </Field>
              <Field label="Penanggung Jawab">
                <span className="inline-flex items-center gap-1.5">
                  <UserCircle weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                  {deal.assignedBy ?? "-"}
                </span>
              </Field>
            </div>

            {/* Col 2 — Pipeline & nilai */}
            <div className="space-y-4">
              <Field label="Pipeline">{deal.pipeline}</Field>
              <Field label="Tahap">
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                  style={
                    deal.stageColor
                      ? { backgroundColor: deal.stageColor, color: contrastText(deal.stageColor) }
                      : undefined
                  }
                >
                  {deal.stage}
                </span>
              </Field>
              <Field label="Nilai (Opportunity)">{fmtMoney(deal.opportunity, deal.currency)}</Field>
            </div>

            {/* Col 3 — Sumber & issue */}
            <div className="space-y-4">
              <Field label="Sumber Informasi">{deal.source}</Field>
              <Field label="Issue">
                {deal.issue ? (
                  <Badge variant="secondary" className="rounded-full font-normal">{deal.issue}</Badge>
                ) : (
                  "-"
                )}
              </Field>
              <Field label="Sub Issue">
                {deal.subIssue ? (
                  <Badge variant="secondary" className="rounded-full font-normal">{deal.subIssue}</Badge>
                ) : (
                  "-"
                )}
              </Field>
              <Field label="Tanggal Database">{fmtDate(deal.dbDate)}</Field>
            </div>

            {/* Col 4 — Tanggal dibuat */}
            <div className="space-y-4">
              <Field label="Dibuat">{fmtDate(deal.dateCreate)}</Field>
              <Field label="Deal ID">{deal.id}</Field>
              {deal.sourceDescription && (
                <Field label="Deskripsi Sumber">{deal.sourceDescription}</Field>
              )}
            </div>
          </div>

          {/* Ads URL */}
          {deal.adsUrl && (
            <div className="mt-6 border-t pt-4">
              <Field label="Ads Source URL">
                <a
                  href={deal.adsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-start gap-1.5 text-primary hover:underline"
                >
                  <LinkIcon weight="BoldDuotone" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="break-all">{deal.adsUrl}</span>
                </a>
              </Field>
            </div>
          )}

          {/* Ads copy */}
          {(deal.adsHeadline || deal.adsBody) && (
            <div className="mt-6 space-y-4">
              {deal.adsHeadline && <Field label="Ads Headline">{deal.adsHeadline}</Field>}
              {deal.adsBody && (
                <Field label="Ads Body">
                  <span className="text-muted-foreground whitespace-pre-wrap">{deal.adsBody}</span>
                </Field>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
