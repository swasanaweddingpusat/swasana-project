"use client";

import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
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
} from "@solar-icons/react";
import type { LeadItem } from "@/lib/queries/leads";
import type { ContactNumber } from "@/types/lead";

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

const lbl = "text-xs font-medium text-muted-foreground uppercase tracking-wide";
const val = "text-sm font-normal text-foreground mt-0.5";

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
  return format(date, "dd MMM yyyy HH:mm");
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

/* ─── Mobile section card ──────────────────────────────────────────────────── */

function MobileCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function MobileField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="text-sm font-normal text-foreground">{children}</div>
    </div>
  );
}

/* ─── Desktop field ────────────────────────────────────────────────────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={lbl}>{label}</p>
      <div className={val}>{children}</div>
    </div>
  );
}

/* ─── Contact Numbers renderer ─────────────────────────────────────────────── */

function ContactNumbers({ raw }: { raw: unknown }) {
  if (!raw) return <span>-</span>;
  let nums: string[] = [];
  try {
    const arr = Array.isArray(raw) ? raw : JSON.parse(String(raw));
    if (Array.isArray(arr)) {
      nums = (arr as ContactNumber[]).map((e) =>
        e.label ? `${e.label}: ${e.number}` : e.number,
      );
    }
  } catch {
    nums = String(raw)
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (nums.length === 0) return <span>-</span>;
  if (nums.length === 1) return <span>{nums[0]}</span>;
  return (
    <ul className="space-y-0.5">
      {nums.map((n, i) => (
        <li key={i}>• {n}</li>
      ))}
    </ul>
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
  if (!open || !lead) return null;

  const isWedding = lead.category !== "MICE";
  const salesName = lead.assignedTo
    ? (lead.assignedTo.nickName ?? lead.assignedTo.fullName ?? "-")
    : (lead.createdBy.nickName ?? lead.createdBy.fullName ?? "-");

  return (
    <div className="fixed inset-0 z-[60] flex bg-black/40 sm:items-center sm:justify-center">
      <div
        className="bg-background w-full h-full flex flex-col sm:rounded-xl sm:shadow-lg sm:w-[70%] sm:max-w-[70%] overflow-hidden sm:h-auto sm:max-h-[90vh]"
        style={{ minWidth: 0 }}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex justify-between items-start px-4 sm:px-8 py-4 border-b sticky top-0 bg-background z-10">
          <div className="flex flex-col gap-1 flex-1 pr-4 min-w-0">
            {/* Mobile: truncated */}
            <h2 className="text-lg font-semibold truncate sm:hidden">{lead.name}</h2>
            {/* Desktop: full */}
            <h2 className="hidden sm:block text-xl font-semibold">{lead.name}</h2>

            {/* Status + category badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: `${lead.status.color}1A`, color: lead.status.color }}
              >
                <span
                  aria-hidden="true"
                  className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: lead.status.color }}
                />
                {lead.status.name}
              </span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-full">
                {isWedding ? "Wedding" : "MICE"}
              </Badge>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Dibuat {fmtDateTime(lead.createdAt)}
              </span>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="shrink-0 h-9 w-9 sm:h-11 sm:w-11 rounded-full flex items-center justify-center cursor-pointer bg-destructive/10 hover:bg-destructive/20 transition-colors"
            aria-label="Tutup"
          >
            <CloseCircle weight="BoldDuotone" className="h-5 w-5 sm:h-6 sm:w-6 text-destructive" />
          </button>
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 px-4 sm:px-8 py-4 pb-24 sm:pb-6 space-y-6">

          {/* ── MOBILE: grouped cards ── */}
          <div className="sm:hidden space-y-4">

            {/* Client */}
            <MobileCard
              title="Client"
              icon={<UserRounded weight="BoldDuotone" className="h-4 w-4" />}
            >
              <MobileField label="Nama">
                {lead.name}
              </MobileField>
              <MobileField label="Kontak">
                <ContactNumbers raw={lead.contactNumbers} />
              </MobileField>
              {isWedding ? (
                <>
                  {lead.emailCpp && (
                    <MobileField label="Email CPP">{lead.emailCpp}</MobileField>
                  )}
                  {lead.emailCpw && (
                    <MobileField label="Email CPW">{lead.emailCpw}</MobileField>
                  )}
                  {lead.nikCpp && (
                    <MobileField label="NIK CPP">{lead.nikCpp}</MobileField>
                  )}
                  {lead.addressCpp && (
                    <MobileField label="Alamat CPP">{lead.addressCpp}</MobileField>
                  )}
                  {lead.nikCpw && (
                    <MobileField label="NIK CPW">{lead.nikCpw}</MobileField>
                  )}
                  {lead.addressCpw && (
                    <MobileField label="Alamat CPW">{lead.addressCpw}</MobileField>
                  )}
                </>
              ) : (
                <>
                  {lead.email && (
                    <MobileField label="Email">{lead.email}</MobileField>
                  )}
                  {lead.instansi && (
                    <MobileField label="Instansi">{lead.instansi}</MobileField>
                  )}
                  {lead.address && (
                    <MobileField label="Alamat">{lead.address}</MobileField>
                  )}
                </>
              )}
            </MobileCard>

            {/* Event */}
            <MobileCard
              title="Event"
              icon={<CalendarMark weight="BoldDuotone" className="h-4 w-4" />}
            >
              {lead.eventDate && (
                <MobileField label="Tanggal Event">
                  {fmtDate(lead.eventDate)}
                  {lead.time ? ` · ${lead.time}` : ""}
                </MobileField>
              )}
              {lead.eventDateAlt && (
                <MobileField label="Tanggal Alternatif">{fmtDate(lead.eventDateAlt)}</MobileField>
              )}
              {isWedding && lead.weddingSession && (
                <MobileField label="Session">{fmtSession(lead.weddingSession)}</MobileField>
              )}
              {lead.eventType && (
                <MobileField label="Event Type">{lead.eventType.name}</MobileField>
              )}
              {lead.estimatedPax && (
                <MobileField label="Estimasi Tamu">
                  {lead.estimatedPax.toLocaleString("id-ID")} pax
                </MobileField>
              )}
              {lead.budgetRange && (
                <MobileField label="Budget Range">{lead.budgetRange}</MobileField>
              )}
            </MobileCard>

            {/* Venue */}
            <MobileCard
              title="Venue"
              icon={<Buildings weight="BoldDuotone" className="h-4 w-4" />}
            >
              {lead.venue ? (
                <MobileField label="Venue Utama">{lead.venue.name}</MobileField>
              ) : (
                <MobileField label="Venue Utama"><span className="text-muted-foreground">Belum dipilih</span></MobileField>
              )}
              {lead.venueSecondary && (
                <MobileField label="Venue Sekunder">{lead.venueSecondary.name}</MobileField>
              )}
            </MobileCard>

            {/* Kunci Tanggal / Booking Fee */}
            <MobileCard
              title="Kunci Tanggal"
              icon={<Wallet weight="BoldDuotone" className="h-4 w-4" />}
            >
              {lead.isDateLocked ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                      Tanggal Dikunci
                    </span>
                  </div>
                  {lead.bookingFeeAmount && (
                    <MobileField label="Booking Fee">{fmtPrice(lead.bookingFeeAmount)}</MobileField>
                  )}
                  {lead.bookingFeeDate && (
                    <MobileField label="Tanggal Bayar">{fmtDate(lead.bookingFeeDate)}</MobileField>
                  )}
                  {lead.bookingFeeEvidenceUrl && (
                    <MobileField label="Bukti Pembayaran">
                      <a
                        href={lead.bookingFeeEvidenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <LinkMinimalistic weight="BoldDuotone" className="h-3.5 w-3.5" />
                        Lihat bukti
                      </a>
                    </MobileField>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Belum dikunci</p>
              )}
            </MobileCard>

            {/* Pipeline */}
            <MobileCard
              title="Pipeline"
              icon={<ClockCircle weight="BoldDuotone" className="h-4 w-4" />}
            >
              <MobileField label="Status">{lead.status.name}</MobileField>
              {lead.sourceOfInformation && (
                <MobileField label="Sumber Informasi">{lead.sourceOfInformation.name}</MobileField>
              )}
              <MobileField label="Sales / PIC">{salesName}</MobileField>
              {lead.notes && (
                <MobileField label="Catatan">{lead.notes}</MobileField>
              )}
              {lead.convertedAt && (
                <MobileField label="Converted">{fmtDateTime(lead.convertedAt)}</MobileField>
              )}
              {lead.convertedToCustomer && (
                <MobileField label="Customer">{lead.convertedToCustomer.name}</MobileField>
              )}
              <MobileField label="Dibuat">{fmtDateTime(lead.createdAt)}</MobileField>
              {lead.updatedAt && (
                <MobileField label="Diperbarui">{fmtDateTime(lead.updatedAt)}</MobileField>
              )}
            </MobileCard>
          </div>

          {/* ── DESKTOP: 4-column grid sections ── */}
          <div className="hidden sm:block space-y-8">

            {/* Client */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <UserRounded weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client</p>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-4">
                <Field label="Nama">{lead.name}</Field>
                <Field label="Kontak">
                  <ContactNumbers raw={lead.contactNumbers} />
                </Field>
                {isWedding ? (
                  <>
                    <Field label="Email CPP">{lead.emailCpp ?? "-"}</Field>
                    <Field label="Email CPW">{lead.emailCpw ?? "-"}</Field>
                    <Field label="NIK CPP">{lead.nikCpp ?? "-"}</Field>
                    <Field label="Alamat CPP">{lead.addressCpp ?? "-"}</Field>
                    <Field label="NIK CPW">{lead.nikCpw ?? "-"}</Field>
                    <Field label="Alamat CPW">{lead.addressCpw ?? "-"}</Field>
                  </>
                ) : (
                  <>
                    <Field label="Email">{lead.email ?? "-"}</Field>
                    <Field label="Instansi">{lead.instansi ?? "-"}</Field>
                    <Field label="Alamat">{lead.address ?? "-"}</Field>
                  </>
                )}
              </div>
            </section>

            <hr className="border-border" />

            {/* Event */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <CalendarMark weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Event</p>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-4">
                <Field label="Tanggal Event">
                  {fmtDate(lead.eventDate)}
                  {lead.time ? <span className="text-muted-foreground"> · {lead.time}</span> : null}
                </Field>
                <Field label="Tanggal Alternatif">{fmtDate(lead.eventDateAlt)}</Field>
                {isWedding && (
                  <Field label="Session">{fmtSession(lead.weddingSession)}</Field>
                )}
                <Field label="Event Type">{lead.eventType?.name ?? "-"}</Field>
                <Field label="Estimasi Tamu">
                  {lead.estimatedPax ? `${lead.estimatedPax.toLocaleString("id-ID")} pax` : "-"}
                </Field>
                <Field label="Budget Range">{lead.budgetRange ?? "-"}</Field>
              </div>
            </section>

            <hr className="border-border" />

            {/* Venue */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Buildings weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Venue</p>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-4">
                <Field label="Venue Utama">{lead.venue?.name ?? "-"}</Field>
                <Field label="Venue Sekunder">{lead.venueSecondary?.name ?? "-"}</Field>
                {lead.package && (
                  <Field label="Paket">{lead.package.packageName}</Field>
                )}
              </div>
            </section>

            <hr className="border-border" />

            {/* Kunci Tanggal */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Wallet weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kunci Tanggal</p>
              </div>
              {lead.isDateLocked ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-4">
                  <Field label="Status">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                      Tanggal Dikunci
                    </span>
                  </Field>
                  <Field label="Booking Fee">{fmtPrice(lead.bookingFeeAmount)}</Field>
                  <Field label="Tanggal Bayar">{fmtDate(lead.bookingFeeDate)}</Field>
                  <Field label="Bukti Pembayaran">
                    {lead.bookingFeeEvidenceUrl ? (
                      <a
                        href={lead.bookingFeeEvidenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <LinkMinimalistic weight="BoldDuotone" className="h-3.5 w-3.5" />
                        Lihat bukti
                      </a>
                    ) : (
                      "-"
                    )}
                  </Field>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Tanggal belum dikunci.</p>
              )}
            </section>

            <hr className="border-border" />

            {/* Pipeline */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <ClockCircle weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pipeline</p>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-4">
                <Field label="Status">{lead.status.name}</Field>
                <Field label="Sumber Informasi">{lead.sourceOfInformation?.name ?? "-"}</Field>
                <Field label="Sales / PIC">{salesName}</Field>
                <Field label="Dibuat">{fmtDateTime(lead.createdAt)}</Field>
                {lead.convertedAt && (
                  <Field label="Converted">{fmtDateTime(lead.convertedAt)}</Field>
                )}
                {lead.convertedToCustomer && (
                  <Field label="Customer">{lead.convertedToCustomer.name}</Field>
                )}
                {lead.notes && (
                  <div className="col-span-2 lg:col-span-4">
                    <Field label="Catatan">{lead.notes}</Field>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        {/* ── Footer actions ─────────────────────────────────────────────────── */}
        {onEdit && (
          <div className="shrink-0 border-t px-4 sm:px-8 py-3 flex items-center justify-end gap-2 bg-background">
            <Button
              variant="outline"
              onClick={() => {
                onClose();
                onEdit(lead);
              }}
            >
              <Pen weight="BoldDuotone" className="h-4 w-4 mr-2" />
              Edit Lead
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
