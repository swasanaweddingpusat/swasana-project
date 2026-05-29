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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Pen, ArrowLeft, ArrowRight, UsersGroupRounded, FileText } from "@solar-icons/react";
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
  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

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
      <div className="overflow-x-auto">
        <Table className="min-w-300 text-sm">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="px-4 whitespace-nowrap w-12 text-right">No</TableHead>
              <TableHead className="px-4 whitespace-nowrap">Nama</TableHead>
              <TableHead className="px-4 whitespace-nowrap">Venue</TableHead>
              <TableHead className="px-4 whitespace-nowrap">Event Type</TableHead>
              <TableHead className="px-4 whitespace-nowrap">Tanggal Event</TableHead>
              <TableHead className="px-4 whitespace-nowrap text-right">Pax</TableHead>
              <TableHead className="px-4 whitespace-nowrap">Paket</TableHead>
              <TableHead className="px-4 whitespace-nowrap">Status</TableHead>
              <TableHead className="px-4 whitespace-nowrap">Sales</TableHead>
              <TableHead className="px-4 whitespace-nowrap">Sumber Info</TableHead>
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
                  <TableCell className="px-4 text-right tabular-nums text-muted-foreground">
                    {rowNumber}
                  </TableCell>
                  <TableCell className="px-4 font-medium max-w-45 truncate" title={lead.name}>
                    <div className="truncate">{lead.name}</div>
                    {firstContact && (
                      <div className="text-xs text-muted-foreground">+{firstContact}</div>
                    )}
                  </TableCell>
                  <TableCell className="px-4 whitespace-nowrap text-foreground/80">
                    {lead.venue?.name ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="px-4 whitespace-nowrap text-foreground/80">
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
                  <TableCell className="px-4 whitespace-nowrap text-foreground/80">
                    {formatEventDate(lead.eventDate)}
                  </TableCell>
                  <TableCell className="px-4 text-right whitespace-nowrap text-foreground/80">
                    {lead.estimatedPax ? lead.estimatedPax.toLocaleString("id-ID") : "—"}
                  </TableCell>
                  <TableCell className="px-4">
                    {lead.package ? (
                      <Badge variant="secondary" className="text-xs">
                        {lead.package.packageName}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
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
                  <TableCell className="px-4 text-muted-foreground whitespace-nowrap">
                    {lead.assignedTo
                      ? (lead.assignedTo.nickName ?? lead.assignedTo.fullName ?? "—")
                      : (lead.createdBy.nickName ?? lead.createdBy.fullName ?? "—")}
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground whitespace-nowrap">
                    {lead.sourceOfInformation?.name ?? "—"}
                  </TableCell>
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

      {/* Pagination */}
      {totalPages > 1 && (
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
          <div className="flex items-center gap-1 overflow-x-auto justify-center">
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
      )}
    </>
  );
}
