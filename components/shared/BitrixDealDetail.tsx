"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@solar-icons/react";

// Enriched deal shape returned by GET /api/bitrix/deals (subset consumed here).
interface BitrixDeal {
  id: string;
  title: string;
  stage: string;
  stageSemantic: "won" | "lost" | "process";
  pipeline: string;
  client: string | null;
  phone: string | null;
  opportunity: number;
  currency: string;
  source: string;
  sourceDescription: string | null;
  assignedBy: string | null;
  issue: string | null;
  adsUrl: string | null;
  adsHeadline: string | null;
  adsBody: string | null;
  dateCreate: string | null;
}

const BITRIX_SEMANTIC_STYLE: Record<BitrixDeal["stageSemantic"], string> = {
  won: "bg-primary/15 text-primary",
  lost: "bg-destructive/10 text-destructive",
  process: "bg-blue-50 text-blue-600",
};

const lbl = "text-sm font-medium mb-0 text-muted-foreground";
const val = "text-sm font-normal text-foreground";

function fmtPrice(v: number | null | undefined): string {
  if (!v) return "-";
  return `Rp ${new Intl.NumberFormat("id-ID").format(Number(v))}`;
}

function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function BitrixField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={lbl}>{label}</p>
      <p className={val}>{children}</p>
    </div>
  );
}

/** Fetches and renders a Bitrix24 deal by id. Reuses GET /api/bitrix/deals
 *  filtered by ID — same enriched shape used by the search dropdown. Shows a
 *  skeleton while loading and a soft error card (with the raw id) if the
 *  deal can't be resolved, so it never blocks the surrounding detail view. */
export function BitrixDealDetail({ dealId }: { dealId: string }) {
  const [deal, setDeal] = useState<BitrixDeal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/bitrix/deals?filter[ID]=${encodeURIComponent(dealId)}`)
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as
          | { items?: BitrixDeal[]; error?: string }
          | null;
        if (cancelled) return;
        if (!res.ok || !json) {
          setError(json?.error ?? "Gagal mengambil data Bitrix.");
          return;
        }
        const found = json.items?.[0] ?? null;
        if (!found) {
          setError(`Deal dengan ID ${dealId} tidak ditemukan di Bitrix.`);
          return;
        }
        setDeal(found);
      })
      .catch(() => {
        if (!cancelled) setError("Gagal menghubungi Bitrix.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dealId]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <p className="mt-1 text-xs text-muted-foreground">Bitrix ID: {dealId}</p>
      </div>
    );
  }

  if (!deal) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-foreground">{deal.title}</h3>
        <Badge className={BITRIX_SEMANTIC_STYLE[deal.stageSemantic]}>{deal.stage}</Badge>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
        <BitrixField label="Deal ID">{deal.id}</BitrixField>
        <BitrixField label="Pipeline">{deal.pipeline}</BitrixField>
        <BitrixField label="Stage">{deal.stage}</BitrixField>
        <BitrixField label="Client">{deal.client ?? "-"}</BitrixField>
        <BitrixField label="Phone">{deal.phone ?? "-"}</BitrixField>
        <BitrixField label="Nilai (Opportunity)">
          {deal.opportunity ? `${fmtPrice(deal.opportunity)}` : "-"}
        </BitrixField>
        <BitrixField label="Source">
          <span>{deal.source}</span>
          {deal.adsUrl && (
            <a
              href={deal.adsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 flex items-center gap-1 text-blue-600 hover:underline break-all"
            >
              <Link weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{deal.adsUrl}</span>
            </a>
          )}
        </BitrixField>
        <BitrixField label="Source Description">{deal.sourceDescription ?? "-"}</BitrixField>
        <BitrixField label="PIC (Assigned)">{deal.assignedBy ?? "-"}</BitrixField>
        <BitrixField label="Issue">{deal.issue ?? "-"}</BitrixField>
        <BitrixField label="Ads Headline">{deal.adsHeadline ?? "-"}</BitrixField>
        <BitrixField label="Dibuat">{fmtDateTime(deal.dateCreate)}</BitrixField>
        {deal.adsBody && (
          <div className="sm:col-span-2 lg:col-span-3">
            <p className={lbl}>Ads Body</p>
            <p className={val}>{deal.adsBody}</p>
          </div>
        )}
      </div>
    </div>
  );
}
