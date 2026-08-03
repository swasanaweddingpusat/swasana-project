"use client";

import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pen,
  ArrowLeft,
  ArrowRight,
  UsersGroupRounded,
  CalendarMark,
  TrashBinTrash,
  CheckCircle,
  CloseCircle,
  MenuDots,
  Refresh,
  Heart,
  Suitcase,
  Phone,
  Buildings2,
} from "@solar-icons/react";
import { PermissionGate } from "@/components/shared/permission-gate";
import { cn } from "@/lib/utils";
import type { LeadItem } from "@/lib/queries/leads";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatShortDate(date: Date | string | null): string {
  if (!date) return "—";
  return format(new Date(date), "d MMM yyyy");
}

/** First contact from the stored contactNumbers JSON, or null when empty. */
function firstContactNumber(
  contactNumbers: LeadItem["contactNumbers"],
): { label: string; number: string } | null {
  if (!Array.isArray(contactNumbers) || contactNumbers.length === 0) return null;
  const c = contactNumbers[0] as { label?: string; number?: string };
  if (!c?.number) return null;
  return { label: c.label ?? "", number: c.number };
}

/** Two-letter initials for the sales PIC avatar. Filters non-alpha tokens
 *  (e.g. the "&" in "Budi & Siti") so couples resolve to real initials. */
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => /[a-zA-Z]/.test(w));
  if (words.length === 0) return "?";
  const first = words[0][0];
  const second = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + second).toUpperCase();
}

/** Sales PIC display name — prefer assignee nickname, fall back to creator. */
function salesLabel(lead: LeadItem): string {
  const src = lead.assignedTo ?? lead.createdBy;
  return src.nickName ?? src.fullName ?? "—";
}

// ─── Shared atoms ───────────────────────────────────────────────────────────

/** Pipeline status pill. Color is a per-status DB value (LeadStatus.color),
 *  rendered as a soft tint + dot — the only data-driven color on the surface. */
function StatusPill({
  status,
  className,
}: {
  status: LeadItem["status"];
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
        className,
      )}
      style={{ backgroundColor: `${status.color}1A`, color: status.color }}
    >
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
        style={{ backgroundColor: status.color }}
      />
      {status.name}
    </span>
  );
}

/** Category chip — Wedding vs MICE, icon-led to match the create drawer's
 *  visual language. Token-only colors. */
function CategoryChip({ category }: { category: string }) {
  const isMice = category === "MICE";
  const Icon = isMice ? Suitcase : Heart;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
      <Icon weight="BoldDuotone" aria-hidden="true" className="h-3 w-3" />
      {isMice ? "MICE" : "Wedding"}
    </span>
  );
}

/** Sales PIC avatar + name. */
function SalesChip({ lead, className }: { lead: LeadItem; className?: string }) {
  const name = salesLabel(lead);
  return (
    <span className={cn("flex items-center gap-2 min-w-0", className)}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-foreground">
        {getInitials(name)}
      </span>
      <span className="truncate text-xs text-muted-foreground">{name}</span>
    </span>
  );
}

/** Action menu shared by card + table rows. */
function LeadActionsMenu({
  lead,
  onMarkDeal,
  onMarkLost,
  onReset,
  onDelete,
  triggerLabel,
}: {
  lead: LeadItem;
  onMarkDeal: (lead: LeadItem) => void;
  onMarkLost: (lead: LeadItem) => void;
  onReset: (lead: LeadItem) => void;
  onDelete: (lead: LeadItem) => void;
  triggerLabel: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full" aria-label={triggerLabel}>
          <MenuDots weight="BoldDuotone" aria-hidden="true" className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {!lead.status.isFinal && (
          <DropdownMenuItem onClick={() => onMarkDeal(lead)}>
            <CheckCircle weight="BoldDuotone" aria-hidden="true" className="h-4 w-4 mr-2 text-primary" />
            Tandai sebagai Deal
          </DropdownMenuItem>
        )}
        {!lead.status.isFinal && (
          <DropdownMenuItem onClick={() => onMarkLost(lead)}>
            <CloseCircle weight="BoldDuotone" aria-hidden="true" className="h-4 w-4 mr-2 text-destructive" />
            Tandai sebagai Lost
          </DropdownMenuItem>
        )}
        {lead.status.isFinal && (
          <DropdownMenuItem onClick={() => onReset(lead)}>
            <Refresh weight="BoldDuotone" aria-hidden="true" className="h-4 w-4 mr-2 text-muted-foreground" />
            Reset ke Cold
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <PermissionGate module="leads" action="delete">
          <DropdownMenuItem
            onClick={() => onDelete(lead)}
            className="text-destructive focus:text-destructive"
          >
            <TrashBinTrash weight="BoldDuotone" aria-hidden="true" className="h-4 w-4 mr-2" />
            Hapus
          </DropdownMenuItem>
        </PermissionGate>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface LeadsListViewProps {
  leads: LeadItem[];
  search: string;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit: (lead: LeadItem) => void;
  onDelete: (lead: LeadItem) => void;
  onMarkDeal: (lead: LeadItem) => void;
  onMarkLost: (lead: LeadItem) => void;
  onReset: (lead: LeadItem) => void;
  onViewDetail: (lead: LeadItem) => void;
  isLoading?: boolean;
}

// ─── Lead Card (mobile + tablet) ──────────────────────────────────────────────

function LeadCard({
  lead,
  onEdit,
  onDelete,
  onMarkDeal,
  onMarkLost,
  onReset,
  onViewDetail,
}: {
  lead: LeadItem;
  onEdit: (lead: LeadItem) => void;
  onDelete: (lead: LeadItem) => void;
  onMarkDeal: (lead: LeadItem) => void;
  onMarkLost: (lead: LeadItem) => void;
  onReset: (lead: LeadItem) => void;
  onViewDetail: (lead: LeadItem) => void;
}) {
  const contact = firstContactNumber(lead.contactNumbers);
  const isMice = lead.category === "MICE";

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onViewDetail(lead);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Lihat detail lead ${lead.name}`}
      onClick={() => onViewDetail(lead)}
      onKeyDown={handleKeyDown}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm cursor-pointer",
        "transition-shadow hover:shadow-md motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
    >
      {/* Status spine — pipeline color at a glance */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ backgroundColor: lead.status.color }}
      />

      <div className="flex flex-col gap-3 p-4 pl-5">
        {/* Header: name + contact ·· status */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-heading text-[15px] font-semibold leading-tight text-foreground truncate">
              {lead.name}
            </h3>
            {contact && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Phone weight="BoldDuotone" aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                <span className="tabular-nums truncate">+{contact.number}</span>
              </p>
            )}
          </div>
          <StatusPill status={lead.status} className="shrink-0" />
        </div>

        {/* Chips: category (+ segment/instansi for MICE) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <CategoryChip category={lead.category} />
          {isMice && lead.instansi && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-foreground/80 max-w-full"
              title={lead.instansi}
            >
              <Buildings2 weight="BoldDuotone" aria-hidden="true" className="h-3 w-3 shrink-0" />
              <span className="truncate">{lead.instansi}</span>
            </span>
          )}
          {lead.sourceOfInformation?.name && (
            <span className="text-[11px] text-muted-foreground truncate">
              · {lead.sourceOfInformation.name}
            </span>
          )}
        </div>

        {/* Meta: aging + pax */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarMark weight="BoldDuotone" aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            Masuk {formatShortDate(lead.createdAt)}
          </span>
          {lead.estimatedPax != null && (
            <span className="flex items-center gap-1.5">
              <UsersGroupRounded weight="BoldDuotone" aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              {lead.estimatedPax.toLocaleString("id-ID")} pax
            </span>
          )}
        </div>

        {/* Footer: sales PIC ·· actions */}
        <div
          className="flex items-center justify-between gap-2 pt-3 border-t border-border"
          onClick={(e) => e.stopPropagation()}
        >
          <SalesChip lead={lead} className="flex-1" />
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="outline"
              className="h-9 rounded-full px-3 text-xs"
              onClick={() => onEdit(lead)}
              aria-label={`Edit lead ${lead.name}`}
            >
              <Pen weight="BoldDuotone" aria-hidden="true" className="h-3.5 w-3.5 mr-1" />
              Edit
            </Button>
            <LeadActionsMenu
              lead={lead}
              onMarkDeal={onMarkDeal}
              onMarkLost={onMarkLost}
              onReset={onReset}
              onDelete={onDelete}
              triggerLabel={`Aksi lainnya untuk lead ${lead.name}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function PaginationBar({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <nav
      aria-label="Navigasi halaman lead"
      className="flex flex-col gap-3 px-4 sm:px-6 py-4 border-t sm:flex-row sm:justify-between sm:items-center"
    >
      <Button
        variant="outline"
        className="rounded-full"
        onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
        disabled={currentPage === 1}
        aria-label="Halaman sebelumnya"
      >
        <ArrowLeft weight="BoldDuotone" aria-hidden="true" className="w-4 h-4" /> Previous
      </Button>

      {/* Mobile: page X / Y */}
      <span className="text-sm text-muted-foreground text-center sm:hidden">
        {currentPage} / {totalPages}
      </span>

      {/* Desktop: numbered pages */}
      <div className="hidden sm:flex items-center gap-1 overflow-x-auto justify-center">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
          const isCurrent = currentPage === page;
          return (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              aria-label={`Halaman ${page}`}
              aria-current={isCurrent ? "page" : undefined}
              className={cn(
                "px-3 py-1 rounded-full text-sm font-medium shrink-0",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isCurrent
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted",
              )}
            >
              {page}
            </button>
          );
        })}
      </div>

      <Button
        variant="outline"
        className="rounded-full"
        onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
        disabled={currentPage === totalPages}
        aria-label="Halaman berikutnya"
      >
        Next <ArrowRight weight="BoldDuotone" aria-hidden="true" className="w-4 h-4" />
      </Button>
    </nav>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LeadsListView({
  leads,
  search,
  currentPage,
  pageSize,
  totalPages,
  onPageChange,
  onEdit,
  onDelete,
  onMarkDeal,
  onMarkLost,
  onReset,
  onViewDetail,
  isLoading,
}: LeadsListViewProps) {
  // ── Loading state ──
  if (isLoading) {
    return (
      <>
        {/* Card grid skeleton (mobile + tablet) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 sm:p-4 lg:hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>

        {/* Table skeleton (desktop) */}
        <div className="hidden lg:block p-6 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      </>
    );
  }

  // ── Empty state ──
  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <UsersGroupRounded weight="BoldDuotone" aria-hidden="true" className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">
          {search ? `Tidak ada hasil untuk "${search}"` : "Belum ada lead."}
        </p>
      </div>
    );
  }

  return (
    <>
      {/* ── Mobile + Tablet: Card grid (<lg) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 sm:p-4 lg:hidden bg-muted/20">
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onEdit={onEdit}
            onDelete={onDelete}
            onMarkDeal={onMarkDeal}
            onMarkLost={onMarkLost}
            onReset={onReset}
            onViewDetail={onViewDetail}
          />
        ))}
      </div>

      {/* ── Desktop: Table (lg+) ── */}
      <div className="hidden lg:block w-full min-w-0">
        <Table className="text-sm w-full">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="px-4 w-12 text-right text-[11px] uppercase tracking-wider text-muted-foreground">
                No
              </TableHead>
              <TableHead className="px-4 text-[11px] uppercase tracking-wider text-muted-foreground">
                Client
              </TableHead>
              <TableHead className="px-4 text-[11px] uppercase tracking-wider text-muted-foreground">
                Kategori
              </TableHead>
              <TableHead className="px-4 text-[11px] uppercase tracking-wider text-muted-foreground">
                Kontak
              </TableHead>
              <TableHead className="px-4 whitespace-nowrap text-[11px] uppercase tracking-wider text-muted-foreground hidden xl:table-cell">
                Masuk
              </TableHead>
              <TableHead className="px-4 text-[11px] uppercase tracking-wider text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="px-4 w-40 text-[11px] uppercase tracking-wider text-muted-foreground">
                Sales
              </TableHead>
              <TableHead className="px-4 w-20 text-right text-[11px] uppercase tracking-wider text-muted-foreground">
                Aksi
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead, index) => {
              const rowNumber = (currentPage - 1) * pageSize + index + 1;
              const contact = firstContactNumber(lead.contactNumbers);
              return (
                <TableRow
                  key={lead.id}
                  className="hover:bg-muted/40 cursor-pointer"
                  onClick={() => onViewDetail(lead)}
                >
                  {/* No */}
                  <TableCell className="px-4 py-3 text-right tabular-nums text-muted-foreground align-top">
                    {rowNumber}
                  </TableCell>

                  {/* Client — name (editorial) + sub: pax · sumber */}
                  <TableCell className="px-4 py-3 max-w-52 align-top" title={lead.name}>
                    <div className="font-heading font-semibold text-foreground truncate">
                      {lead.name}
                    </div>
                    {(() => {
                      const subParts: string[] = [];
                      if (lead.estimatedPax) subParts.push(`${lead.estimatedPax.toLocaleString("id-ID")} pax`);
                      if (lead.sourceOfInformation?.name) subParts.push(lead.sourceOfInformation.name);
                      if (subParts.length === 0) return null;
                      return (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {subParts.join(" · ")}
                        </div>
                      );
                    })()}
                  </TableCell>

                  {/* Kategori — MICE shows instansi as sub-line */}
                  <TableCell className="px-4 py-3 align-top">
                    <CategoryChip category={lead.category} />
                    {lead.category === "MICE" && lead.instansi && (
                      <div
                        className="text-xs text-muted-foreground truncate max-w-40 mt-1"
                        title={lead.instansi}
                      >
                        {lead.instansi}
                      </div>
                    )}
                  </TableCell>

                  {/* Kontak */}
                  <TableCell className="px-4 py-3 text-foreground/80 align-top">
                    {contact ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="whitespace-nowrap font-medium tabular-nums">+{contact.number}</span>
                        {contact.label && (
                          <span className="text-xs text-muted-foreground truncate max-w-36">
                            {contact.label}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Masuk — xl+ */}
                  <TableCell className="px-4 py-3 whitespace-nowrap text-muted-foreground align-top hidden xl:table-cell">
                    {formatShortDate(lead.createdAt)}
                  </TableCell>

                  {/* Status */}
                  <TableCell className="px-4 py-3 align-top">
                    <StatusPill status={lead.status} />
                  </TableCell>

                  {/* Sales */}
                  <TableCell className="px-4 py-3 align-top">
                    <SalesChip lead={lead} />
                  </TableCell>

                  {/* Action — stopPropagation prevents row click from opening detail. */}
                  <TableCell className="px-4 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-full"
                        onClick={() => onEdit(lead)}
                        aria-label={`Edit lead ${lead.name}`}
                      >
                        <Pen weight="BoldDuotone" aria-hidden="true" className="h-4 w-4" />
                      </Button>
                      <LeadActionsMenu
                        lead={lead}
                        onMarkDeal={onMarkDeal}
                        onMarkLost={onMarkLost}
                        onReset={onReset}
                        onDelete={onDelete}
                        triggerLabel={`Aksi lainnya untuk lead ${lead.name}`}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* ── Pagination (both mobile + desktop) ── */}
      {totalPages > 1 && (
        <PaginationBar
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      )}
    </>
  );
}
