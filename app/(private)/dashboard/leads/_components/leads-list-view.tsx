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
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pen,
  ArrowLeft,
  ArrowRight,
  UsersGroupRounded,
  FileText,
  CalendarMark,
  UserCircle,
} from "@solar-icons/react";
import { cn } from "@/lib/utils";
import type { LeadItem } from "@/lib/queries/leads";

function formatEventDate(date: Date | string | null): string {
  if (!date) return "—";
  return format(new Date(date), "d MMM yyyy");
}

interface LeadsListViewProps {
  leads: LeadItem[];
  search: string;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit: (lead: LeadItem) => void;
  onBuatQuotation: (lead: LeadItem) => void;
  isLoading?: boolean;
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
                "px-3 py-1 rounded-md text-sm font-medium shrink-0",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isCurrent
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              )}
            >
              {page}
            </button>
          );
        })}
      </div>

      <Button
        variant="outline"
        onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
        disabled={currentPage === totalPages}
        aria-label="Halaman berikutnya"
      >
        Next <ArrowRight weight="BoldDuotone" aria-hidden="true" className="w-4 h-4" />
      </Button>
    </nav>
  );
}

// ─── Mobile Card List ─────────────────────────────────────────────────────────

function MobileLeadCard({
  lead,
  rowNumber,
  onEdit,
  onBuatQuotation,
}: {
  lead: LeadItem;
  rowNumber: number;
  onEdit: (lead: LeadItem) => void;
  onBuatQuotation: (lead: LeadItem) => void;
}) {
  const firstContact = Array.isArray(lead.contactNumbers)
    ? (lead.contactNumbers[0] as { number?: string } | undefined)?.number ?? ""
    : "";

  const salesName = lead.assignedTo
    ? (lead.assignedTo.nickName ?? lead.assignedTo.fullName ?? "—")
    : (lead.createdBy.nickName ?? lead.createdBy.fullName ?? "—");

  const showBuatQuotation = lead.status.name === "Hot" && !lead.status.isFinal;

  return (
    <Card className="rounded-lg border bg-card">
      <CardContent className="p-3 space-y-2">
        {/* Row 1: Nama + Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {rowNumber}. {lead.name}
            </p>
            {firstContact && (
              <p className="text-xs text-muted-foreground">+{firstContact}</p>
            )}
          </div>
          <span className="flex items-center gap-1.5 shrink-0">
            <span
              aria-hidden="true"
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: lead.status.color }}
            />
            <span className="text-xs font-medium text-foreground/80 whitespace-nowrap">
              {lead.status.name}
            </span>
          </span>
        </div>

        {/* Row 2: Venue + Event Type badge */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
          <span>{lead.venue?.name ?? "Venue —"}</span>
          {lead.eventType && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-foreground/70">{lead.eventType.name}</span>
              <Badge variant="outline" className="text-[10px] px-1 py-0">
                {lead.eventType.category === "MICE" ? "MICE" : "Wedding"}
              </Badge>
            </>
          )}
        </div>

        {/* Row 3: Tanggal + Pax */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarMark weight="BoldDuotone" aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            {formatEventDate(lead.eventDate)}
          </span>
          <span className="flex items-center gap-1">
            <UsersGroupRounded weight="BoldDuotone" aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            {lead.estimatedPax ? lead.estimatedPax.toLocaleString("id-ID") : "—"} pax
          </span>
        </div>

        {/* Row 4: Sales */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <UserCircle weight="BoldDuotone" aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          <span>{salesName}</span>
        </div>

        {/* Footer: Actions */}
        <div className="flex items-center gap-2 pt-1 border-t border-border">
          <Button
            variant="outline"
            className="h-9 flex-1 text-xs"
            onClick={() => onEdit(lead)}
            aria-label={`Edit lead ${lead.name}`}
          >
            <Pen weight="BoldDuotone" aria-hidden="true" className="h-3.5 w-3.5 mr-1" />
            Edit
          </Button>
          {showBuatQuotation && (
            <Button
              variant="outline"
              className="h-9 flex-1 text-xs"
              onClick={() => onBuatQuotation(lead)}
              aria-label={`Buat quotation untuk ${lead.name}`}
            >
              <FileText weight="BoldDuotone" aria-hidden="true" className="h-3.5 w-3.5 mr-1" />
              Quotation
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
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
  onBuatQuotation,
  isLoading,
}: LeadsListViewProps) {
  // ── Loading state ──
  if (isLoading) {
    return (
      <>
        {/* Mobile skeleton */}
        <div className="block sm:hidden p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>

        {/* Desktop/tablet skeleton */}
        <div className="hidden sm:block p-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
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
      {/* ── Mobile: Card List (<sm) ── */}
      <div className="block sm:hidden p-4 space-y-3">
        {leads.map((lead, index) => {
          const rowNumber = (currentPage - 1) * pageSize + index + 1;
          return (
            <MobileLeadCard
              key={lead.id}
              lead={lead}
              rowNumber={rowNumber}
              onEdit={onEdit}
              onBuatQuotation={onBuatQuotation}
            />
          );
        })}
      </div>

      {/* ── Desktop/Tablet: Table (sm+) ── */}
      <div className="hidden sm:block overflow-x-auto">
        <Table className="text-sm">
          <TableHeader>
            <TableRow className="bg-muted/50">
              {/* No — hidden on mobile (already handled by block/hidden wrapper) */}
              <TableHead className="px-4 whitespace-nowrap w-12 text-right hidden sm:table-cell">No</TableHead>
              {/* Nama — always visible (within sm+ context) */}
              <TableHead className="px-4 whitespace-nowrap">Nama</TableHead>
              {/* Venue — tablet+: hidden lg, shown at lg */}
              <TableHead className="px-4 whitespace-nowrap hidden lg:table-cell">Venue</TableHead>
              {/* Event Type — lg+ */}
              <TableHead className="px-4 whitespace-nowrap hidden lg:table-cell">Event Type</TableHead>
              {/* Tanggal Event — lg+ */}
              <TableHead className="px-4 whitespace-nowrap hidden lg:table-cell">Tanggal Event</TableHead>
              {/* Pax — lg+ */}
              <TableHead className="px-4 whitespace-nowrap text-right hidden lg:table-cell">Pax</TableHead>
              {/* Status — always visible */}
              <TableHead className="px-4 whitespace-nowrap">Status</TableHead>
              {/* Sales — sm+ */}
              <TableHead className="px-4 whitespace-nowrap hidden sm:table-cell">Sales</TableHead>
              {/* Sumber Info — lg+ */}
              <TableHead className="px-4 whitespace-nowrap hidden lg:table-cell">Sumber Info</TableHead>
              {/* Action — always visible */}
              <TableHead className="px-4 whitespace-nowrap w-28">
                <span className="sr-only">Aksi</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead, index) => {
              const firstContact = Array.isArray(lead.contactNumbers)
                ? (lead.contactNumbers[0] as { number?: string } | undefined)?.number ?? ""
                : "";
              const rowNumber = (currentPage - 1) * pageSize + index + 1;
              return (
                <TableRow key={lead.id} className="hover:bg-muted/40">
                  {/* No */}
                  <TableCell className="px-4 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                    {rowNumber}
                  </TableCell>

                  {/* Nama — with HP + tanggal subtext for tablet (where date col is hidden) */}
                  <TableCell className="px-4 font-medium max-w-45 truncate" title={lead.name}>
                    <div className="truncate">{lead.name}</div>
                    {firstContact && (
                      <div className="text-xs text-muted-foreground">+{firstContact}</div>
                    )}
                    {/* Tablet only: show event date inline since Tanggal Event col is hidden at md */}
                    <div className="text-xs text-muted-foreground mt-0.5 lg:hidden">
                      {formatEventDate(lead.eventDate)}
                    </div>
                  </TableCell>

                  {/* Venue */}
                  <TableCell className="px-4 whitespace-nowrap text-foreground/80 hidden lg:table-cell">
                    {lead.venue?.name ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>

                  {/* Event Type */}
                  <TableCell className="px-4 whitespace-nowrap text-foreground/80 hidden lg:table-cell">
                    {lead.eventType ? (
                      <span className="flex items-center gap-1.5">
                        {lead.eventType.name}
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {lead.eventType.category === "MICE" ? "MICE" : "Wedding"}
                        </Badge>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Tanggal Event */}
                  <TableCell className="px-4 whitespace-nowrap text-foreground/80 hidden lg:table-cell">
                    {formatEventDate(lead.eventDate)}
                  </TableCell>

                  {/* Pax */}
                  <TableCell className="px-4 text-right whitespace-nowrap text-foreground/80 hidden lg:table-cell">
                    {lead.estimatedPax ? lead.estimatedPax.toLocaleString("id-ID") : "—"}
                  </TableCell>

                  {/* Status */}
                  <TableCell className="px-4">
                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                      <span
                        aria-hidden="true"
                        className="inline-block w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: lead.status.color }}
                      />
                      <span className="text-xs text-foreground/80">{lead.status.name}</span>
                    </span>
                  </TableCell>

                  {/* Sales */}
                  <TableCell className="px-4 text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                    {lead.assignedTo
                      ? (lead.assignedTo.nickName ?? lead.assignedTo.fullName ?? "—")
                      : (lead.createdBy.nickName ?? lead.createdBy.fullName ?? "—")}
                  </TableCell>

                  {/* Sumber Info */}
                  <TableCell className="px-4 text-muted-foreground whitespace-nowrap hidden lg:table-cell">
                    {lead.sourceOfInformation?.name ?? "—"}
                  </TableCell>

                  {/* Action */}
                  <TableCell className="px-4">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(lead)}
                        aria-label={`Edit lead ${lead.name}`}
                      >
                        <Pen weight="BoldDuotone" aria-hidden="true" className="h-4 w-4" />
                      </Button>
                      {lead.status.name === "Hot" && !lead.status.isFinal && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onBuatQuotation(lead)}
                          aria-label={`Buat quotation untuk ${lead.name}`}
                        >
                          <FileText weight="BoldDuotone" aria-hidden="true" className="h-4 w-4" />
                        </Button>
                      )}
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
