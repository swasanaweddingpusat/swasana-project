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
  UserCircle,
  TrashBinTrash,
  CheckCircle,
  CloseCircle,
  MenuDots,
  Refresh,
} from "@solar-icons/react";
import { PermissionGate } from "@/components/shared/permission-gate";
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
  onDelete: (lead: LeadItem) => void;
  onMarkDeal: (lead: LeadItem) => void;
  onMarkLost: (lead: LeadItem) => void;
  onReset: (lead: LeadItem) => void;
  onViewDetail: (lead: LeadItem) => void;
  isLoading?: boolean;
  /** When true, rows are read-only (deleted/trash scope). No edit/delete/mark actions. */
  isDeletedScope?: boolean;
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
  onDelete,
  onMarkDeal,
  onMarkLost,
  onReset,
  onViewDetail,
  isDeletedScope,
}: {
  lead: LeadItem;
  rowNumber: number;
  onEdit: (lead: LeadItem) => void;
  onDelete: (lead: LeadItem) => void;
  onMarkDeal: (lead: LeadItem) => void;
  onMarkLost: (lead: LeadItem) => void;
  onReset: (lead: LeadItem) => void;
  onViewDetail: (lead: LeadItem) => void;
  isDeletedScope?: boolean;
}) {
  const firstContact = Array.isArray(lead.contactNumbers)
    ? (lead.contactNumbers[0] as { number?: string } | undefined)?.number ?? ""
    : "";

  const salesName = lead.assignedTo
    ? (lead.assignedTo.nickName ?? lead.assignedTo.fullName ?? "—")
    : (lead.createdBy.nickName ?? lead.createdBy.fullName ?? "—");

  const showFinalActions = !lead.status.isFinal && !isDeletedScope;

  return (
    <Card
      className="rounded-lg border bg-card cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => onViewDetail(lead)}
    >
      <CardContent className="px-3 py-2 space-y-1.5">
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
        <div className="flex items-start gap-1.5 flex-wrap text-xs text-muted-foreground">
          <span className="flex flex-col gap-0.5 min-w-0">
            <span className="truncate">{lead.venue?.name ?? "Venue —"}</span>
            {lead.venueSecondary && (
              <span className="text-muted-foreground/70 truncate">{lead.venueSecondary.name}</span>
            )}
          </span>
          {lead.eventType && (
            <>
              <span aria-hidden="true" className="mt-0.5">·</span>
              <span className="text-foreground/70 mt-0.5">{lead.eventType.name}</span>
              <Badge variant="outline" className="text-[10px] px-1 py-0 mt-0.5">
                {lead.eventType.category === "MICE" ? "MICE" : "Wedding"}
              </Badge>
            </>
          )}
        </div>

        {/* Row 3: Tanggal + Pax */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-start gap-1">
            <CalendarMark weight="BoldDuotone" aria-hidden="true" className="h-3.5 w-3.5 shrink-0 mt-px" />
            <span className="flex flex-col gap-0.5">
              <span>
                {formatEventDate(lead.eventDate)}
                {lead.time && <span className="text-muted-foreground"> · {lead.time}</span>}
              </span>
              {lead.eventDateAlt && (
                <span className="text-muted-foreground/70">alt: {formatEventDate(lead.eventDateAlt)}</span>
              )}
            </span>
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

        {/* Footer: Actions — read-only in deleted scope */}
        {isDeletedScope ? (
          <div className="pt-1 border-t border-border">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <TrashBinTrash weight="BoldDuotone" aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              Dihapus {lead.deletedAt ? format(new Date(lead.deletedAt), "d MMM yyyy") : ""}
            </p>
          </div>
        ) : (
          <div
            className="flex items-center gap-2 pt-1 border-t border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="outline"
              className="h-9 flex-1 text-xs"
              onClick={() => onEdit(lead)}
              aria-label={`Edit lead ${lead.name}`}
            >
              <Pen weight="BoldDuotone" aria-hidden="true" className="h-3.5 w-3.5 mr-1" />
              Edit
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 shrink-0"
                  aria-label={`Aksi lainnya untuk lead ${lead.name}`}
                >
                  <MenuDots weight="BoldDuotone" aria-hidden="true" className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {showFinalActions && (
                  <DropdownMenuItem onClick={() => onMarkDeal(lead)}>
                    <CheckCircle weight="BoldDuotone" aria-hidden="true" className="h-4 w-4 mr-2 text-primary" />
                    Tandai sebagai Deal
                  </DropdownMenuItem>
                )}
                {showFinalActions && (
                  <DropdownMenuItem onClick={() => onMarkLost(lead)}>
                    <CloseCircle weight="BoldDuotone" aria-hidden="true" className="h-4 w-4 mr-2 text-destructive" />
                    Tandai sebagai Lost
                  </DropdownMenuItem>
                )}
                {lead.status.isFinal && !isDeletedScope && (
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
          </div>
        )}
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
  onDelete,
  onMarkDeal,
  onMarkLost,
  onReset,
  onViewDetail,
  isLoading,
  isDeletedScope,
}: LeadsListViewProps) {
  // ── Loading state ──
  if (isLoading) {
    return (
      <>
        {/* Mobile skeleton */}
        <div className="block sm:hidden px-3 py-2 space-y-2">
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
          {search
            ? `Tidak ada hasil untuk "${search}"`
            : isDeletedScope
              ? "Tidak ada leads yang dihapus."
              : "Belum ada lead."}
        </p>
      </div>
    );
  }

  return (
    <>
      {/* ── Mobile: Card List (<sm) ── */}
      <div className="block sm:hidden px-3 py-2 space-y-2">
        {leads.map((lead, index) => {
          const rowNumber = (currentPage - 1) * pageSize + index + 1;
          return (
            <MobileLeadCard
              key={lead.id}
              lead={lead}
              rowNumber={rowNumber}
              onEdit={onEdit}
              onDelete={onDelete}
              onMarkDeal={onMarkDeal}
              onMarkLost={onMarkLost}
              onReset={onReset}
              onViewDetail={onViewDetail}
              isDeletedScope={isDeletedScope}
            />
          );
        })}
      </div>

      {/* ── Desktop/Tablet: Table (sm+) ── */}
      <div className="hidden sm:block w-full min-w-0">
        <Table className="text-sm w-full">
          <TableHeader>
            <TableRow className="bg-muted/50">
              {/* No — hidden on mobile (already handled by block/hidden wrapper) */}
              <TableHead className="px-4 whitespace-nowrap w-12 text-right hidden sm:table-cell">No</TableHead>
              {/* Client — always visible; sub-row embeds pax + sumber */}
              <TableHead className="px-4 whitespace-nowrap">Client</TableHead>
              {/* Tanggal Event — md+ (freed up after Pax/Sumber removed) */}
              <TableHead className="px-4 whitespace-nowrap hidden md:table-cell">Tanggal Event</TableHead>
              {/* Venue — lg+ */}
              <TableHead className="px-4 whitespace-nowrap hidden lg:table-cell">Venue</TableHead>
              {/* Event Type — xl+ (push out to give lg breathing room) */}
              <TableHead className="px-4 whitespace-nowrap hidden xl:table-cell">Event Type</TableHead>
              {/* Status — always visible */}
              <TableHead className="px-4 whitespace-nowrap">Status</TableHead>
              {/* Sales — md+ */}
              <TableHead className="px-4 whitespace-nowrap w-24 hidden md:table-cell">Sales</TableHead>
              {/* Action — always visible */}
              <TableHead className="px-4 whitespace-nowrap w-20 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead, index) => {
              const rowNumber = (currentPage - 1) * pageSize + index + 1;
              return (
                <TableRow
                  key={lead.id}
                  className="hover:bg-muted/40 cursor-pointer"
                  onClick={() => onViewDetail(lead)}
                >
                  {/* No */}
                  <TableCell className="px-4 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                    {rowNumber}
                  </TableCell>

                  {/* Client — primary: name bold; sub: pax · sumber */}
                  <TableCell className="px-4 max-w-52" title={lead.name}>
                    <div className="font-medium truncate">{lead.name}</div>
                    {(() => {
                      const paxPart = lead.estimatedPax
                        ? `${lead.estimatedPax.toLocaleString("id-ID")} pax`
                        : null;
                      const sumberPart = lead.sourceOfInformation?.name ?? null;
                      const subParts: string[] = [];
                      if (paxPart) subParts.push(paxPart);
                      if (sumberPart) subParts.push(sumberPart);
                      if (subParts.length > 0) {
                        return (
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {subParts.join(" · ")}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </TableCell>

                  {/* Tanggal Event — md+ */}
                  <TableCell className="px-4 text-foreground/80 hidden md:table-cell">
                    <div className="whitespace-nowrap">{formatEventDate(lead.eventDate)}</div>
                    {lead.time && (
                      <div className="text-xs text-muted-foreground">{lead.time}</div>
                    )}
                    {lead.eventDateAlt && (
                      <div className="text-xs text-muted-foreground/70 whitespace-nowrap">
                        alt: {formatEventDate(lead.eventDateAlt)}
                      </div>
                    )}
                  </TableCell>

                  {/* Venue — lg+ */}
                  <TableCell className="px-4 text-foreground/80 hidden lg:table-cell">
                    {lead.venue ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="truncate max-w-36" title={lead.venue.name}>
                          {lead.venue.name}
                        </span>
                        {lead.venueSecondary && (
                          <span
                            className="text-xs text-muted-foreground/70 truncate max-w-36"
                            title={lead.venueSecondary.name}
                          >
                            {lead.venueSecondary.name}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Event Type — xl+ */}
                  <TableCell className="px-4 whitespace-nowrap text-foreground/80 hidden xl:table-cell">
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

                  {/* Status — pill style */}
                  <TableCell className="px-4">
                    <span
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{ backgroundColor: `${lead.status.color}1A`, color: lead.status.color }}
                    >
                      <span
                        aria-hidden="true"
                        className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: lead.status.color }}
                      />
                      {lead.status.name}
                    </span>
                  </TableCell>

                  {/* Sales — md+ */}
                  <TableCell className="px-4 text-muted-foreground align-top hidden md:table-cell">
                    <div className="w-24 whitespace-normal break-words leading-tight text-sm">
                      {lead.assignedTo
                        ? (lead.assignedTo.nickName ?? lead.assignedTo.fullName ?? "—")
                        : (lead.createdBy.nickName ?? lead.createdBy.fullName ?? "—")}
                    </div>
                  </TableCell>

                  {/* Action — read-only in deleted scope. stopPropagation prevents row click from opening detail. */}
                  <TableCell className="px-4" onClick={(e) => e.stopPropagation()}>
                    {isDeletedScope ? (
                      <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                        <TrashBinTrash weight="BoldDuotone" aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                        {lead.deletedAt ? format(new Date(lead.deletedAt), "d MMM yyyy") : "—"}
                      </span>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(lead)}
                          aria-label={`Edit lead ${lead.name}`}
                        >
                          <Pen weight="BoldDuotone" aria-hidden="true" className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Aksi lainnya untuk lead ${lead.name}`}
                            >
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
                      </div>
                    )}
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
