"use client";

import { useEffect } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  CloseCircle,
  UserRounded,
  CalendarMark,
  Buildings,
  Wallet,
  ClockCircle,
  Pen,
  LinkMinimalistic,
  Heart,
  Suitcase,
  type IconProps,
} from "@solar-icons/react";
import { cn } from "@/lib/utils";
import type { LeadItem } from "@/lib/queries/leads";
import type { ContactNumber } from "@/types/lead";

/* ─── Field styling tokens ─────────────────────────────────────────────────── */

const LABEL = "text-[11px] font-medium uppercase tracking-wider text-muted-foreground";
const VALUE = "mt-1 text-sm text-foreground break-words";

/* ─── Formatters ───────────────────────────────────────────────────────────── */

function fmtPrice(v: number | null | undefined): string {
  if (v == null) return "-";
  return `Rp ${new Intl.NumberFormat("id-ID").format(Number(v))}`;
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "-";
  return format(date, "dd MMM yyyy");
}

function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "-";
  return format(date, "dd MMM yyyy · HH:mm");
}

function fmtSession(session: string | null | undefined): string {
  if (!session) return "-";
  const map: Record<string, string> = {
    morning: "Pagi",
    evening: "Malam",
    fullday: "Full Day",
  };
  return map[session] ?? session;
}

/** Parse the stored contactNumbers JSON into a typed list (empty when absent). */
function parseContacts(raw: unknown): ContactNumber[] {
  if (!raw) return [];
  let arr: unknown = raw;
  if (!Array.isArray(arr)) {
    try {
      arr = JSON.parse(String(raw));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return (arr as ContactNumber[])
    .filter((e) => e && e.number)
    .map((e) => ({ label: e.label ?? "", number: e.number }));
}

/* ─── Presence-aware section ───────────────────────────────────────────────── */

type FieldDef = { label: string; value: React.ReactNode; full?: boolean };

type SolarIcon = React.ForwardRefExoticComponent<
  Omit<IconProps, "ref"> & React.RefAttributes<SVGSVGElement>
>;

/** Renders a titled card of fields. Returns null when it has nothing to show,
 *  so category-irrelevant sections (e.g. wedding venue on a MICE lead) vanish. */
function InfoSection({
  icon: Icon,
  title,
  fields,
}: {
  icon: SolarIcon;
  title: string;
  fields: FieldDef[];
}) {
  if (fields.length === 0) return null;
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Icon weight="BoldDuotone" aria-hidden className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((f, i) => (
          <div key={i} className={cn(f.full && "sm:col-span-2 lg:col-span-3")}>
            <dt className={LABEL}>{f.label}</dt>
            <dd className={VALUE}>{f.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ─── Props ────────────────────────────────────────────────────────────────── */

interface Props {
  open: boolean;
  lead: LeadItem | null;
  onClose: () => void;
  onEdit?: (lead: LeadItem) => void;
}

/* ─── Component ────────────────────────────────────────────────────────────── */

export function LeadDetailModal({ open, lead, onClose, onEdit }: Props) {
  // Escape-to-close — hook must run unconditionally (before any early return).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !lead) return null;

  const isWedding = lead.category !== "MICE";
  const CategoryIcon = isWedding ? Heart : Suitcase;
  const salesName = lead.assignedTo
    ? (lead.assignedTo.nickName ?? lead.assignedTo.fullName ?? "-")
    : (lead.createdBy.nickName ?? lead.createdBy.fullName ?? "-");

  const contacts = parseContacts(lead.contactNumbers);
  const evidenceLink = lead.bookingFeeEvidenceUrl ? (
    <a
      href={lead.bookingFeeEvidenceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
    >
      <LinkMinimalistic weight="BoldDuotone" aria-hidden className="h-3.5 w-3.5" />
      Lihat bukti
    </a>
  ) : null;

  // ── Client ──
  const clientFields: FieldDef[] = [];
  if (contacts.length > 0) {
    clientFields.push({
      label: "Kontak",
      value: (
        <ul className="space-y-1">
          {contacts.map((c, i) => (
            <li key={i} className="flex items-baseline gap-2">
              {c.label && <span className="text-xs text-muted-foreground">{c.label}</span>}
              <span className="font-medium tabular-nums">+{c.number}</span>
            </li>
          ))}
        </ul>
      ),
    });
  }
  if (isWedding) {
    if (lead.emailCpp) clientFields.push({ label: "Email CPP", value: lead.emailCpp });
    if (lead.emailCpw) clientFields.push({ label: "Email CPW", value: lead.emailCpw });
    if (lead.nikCpp) clientFields.push({ label: "NIK CPP", value: <span className="font-mono">{lead.nikCpp}</span> });
    if (lead.nikCpw) clientFields.push({ label: "NIK CPW", value: <span className="font-mono">{lead.nikCpw}</span> });
    if (lead.addressCpp) clientFields.push({ label: "Alamat CPP", value: lead.addressCpp, full: true });
    if (lead.addressCpw) clientFields.push({ label: "Alamat CPW", value: lead.addressCpw, full: true });
  } else {
    if (lead.email) clientFields.push({ label: "Email", value: lead.email });
    if (lead.segment?.name ?? lead.instansi) {
      clientFields.push({ label: "Segment / Kategori", value: lead.segment?.name ?? lead.instansi });
    }
    if (lead.address) clientFields.push({ label: "Alamat", value: lead.address, full: true });
  }

  // ── Event ──
  const eventFields: FieldDef[] = [];
  if (lead.eventDate) {
    eventFields.push({
      label: "Tanggal Event",
      value: (
        <>
          {fmtDate(lead.eventDate)}
          {lead.time ? <span className="text-muted-foreground"> · {lead.time}</span> : null}
        </>
      ),
    });
  }
  if (isWedding && lead.weddingSession) {
    eventFields.push({ label: "Sesi (Utama)", value: fmtSession(lead.weddingSession) });
  }
  if (lead.eventDateAlt) {
    eventFields.push({
      label: "Tanggal Alternatif",
      value: (
        <>
          {fmtDate(lead.eventDateAlt)}
          {isWedding && lead.weddingSessionAlt ? (
            <span className="text-muted-foreground"> · {fmtSession(lead.weddingSessionAlt)}</span>
          ) : null}
        </>
      ),
    });
  }
  if (lead.eventType) eventFields.push({ label: "Event Type", value: lead.eventType.name });
  if (lead.estimatedPax) {
    eventFields.push({ label: "Estimasi Tamu", value: `${lead.estimatedPax.toLocaleString("id-ID")} pax` });
  }
  if (lead.budgetRange) eventFields.push({ label: "Budget Range", value: lead.budgetRange });

  // ── Venue ──
  const venueFields: FieldDef[] = [];
  if (lead.venue) venueFields.push({ label: "Venue Utama", value: lead.venue.name });
  if (lead.venueSecondary) venueFields.push({ label: "Venue Sekunder", value: lead.venueSecondary.name });
  if (lead.package) venueFields.push({ label: "Paket", value: lead.package.packageName });

  // ── Kunci Tanggal (only when locked) ──
  const lockFields: FieldDef[] = [];
  if (lead.isDateLocked) {
    lockFields.push({
      label: "Status",
      value: (
        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          Tanggal Dikunci
        </span>
      ),
    });
    if (lead.bookingFeeAmount) lockFields.push({ label: "Booking Fee", value: fmtPrice(lead.bookingFeeAmount) });
    if (lead.bookingFeeDate) lockFields.push({ label: "Tanggal Bayar", value: fmtDate(lead.bookingFeeDate) });
    if (evidenceLink) lockFields.push({ label: "Bukti Pembayaran", value: evidenceLink });
  }

  // ── Pipeline ──
  const pipelineFields: FieldDef[] = [];
  if (lead.sourceOfInformation) {
    pipelineFields.push({ label: "Sumber Informasi", value: lead.sourceOfInformation.name });
  }
  pipelineFields.push({ label: "Sales / PIC", value: salesName });
  pipelineFields.push({ label: "Dibuat", value: fmtDateTime(lead.createdAt) });
  if (lead.updatedAt) pipelineFields.push({ label: "Diperbarui", value: fmtDateTime(lead.updatedAt) });
  if (lead.convertedAt) pipelineFields.push({ label: "Converted", value: fmtDateTime(lead.convertedAt) });
  if (lead.convertedToCustomer) pipelineFields.push({ label: "Customer", value: lead.convertedToCustomer.name });
  if (lead.notes) pipelineFields.push({ label: "Catatan", value: lead.notes, full: true });

  return (
    <div className="fixed inset-0 z-[60] flex bg-black/40 sm:items-center sm:justify-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-detail-title"
        className="relative flex h-full w-full flex-col overflow-hidden bg-background sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-4xl sm:rounded-2xl sm:shadow-lg"
      >
        {/* Status spine — pipeline color at a glance (signature, matches table cards) */}
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 z-20 w-1.5"
          style={{ backgroundColor: lead.status.color }}
        />

        {/* ── Header ── */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-background px-5 py-4 pl-6 sm:px-8 sm:pl-9">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <h2
              id="lead-detail-title"
              className="truncate font-heading text-lg font-semibold text-foreground sm:text-xl"
            >
              {lead.name}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: `${lead.status.color}1A`, color: lead.status.color }}
              >
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: lead.status.color }}
                />
                {lead.status.name}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                <CategoryIcon weight="BoldDuotone" aria-hidden className="h-3 w-3" />
                {isWedding ? "Wedding" : "MICE"}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 transition-colors hover:bg-destructive/20 sm:h-11 sm:w-11"
            aria-label="Tutup detail lead"
          >
            <CloseCircle weight="BoldDuotone" className="h-5 w-5 text-destructive sm:h-6 sm:w-6" />
          </button>
        </div>

        {/* ── Body — single presence-aware tree, responsive across all breakpoints ── */}
        <div className="flex-1 space-y-4 overflow-y-auto bg-muted/20 px-4 py-4 pb-24 pl-5 sm:px-8 sm:pb-6 sm:pl-9">
          <InfoSection icon={UserRounded} title="Client" fields={clientFields} />
          <InfoSection icon={CalendarMark} title="Event" fields={eventFields} />
          <InfoSection icon={Buildings} title="Venue" fields={venueFields} />
          <InfoSection icon={Wallet} title="Kunci Tanggal" fields={lockFields} />
          <InfoSection icon={ClockCircle} title="Pipeline" fields={pipelineFields} />
        </div>

        {/* ── Footer ── */}
        {onEdit && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t bg-background px-5 py-3 pl-6 sm:px-8 sm:pl-9">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                onClose();
                onEdit(lead);
              }}
            >
              <Pen weight="BoldDuotone" aria-hidden className="mr-2 h-4 w-4" />
              Edit Lead
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
