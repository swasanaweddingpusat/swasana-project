"use client";

import { format } from "date-fns";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, CloseCircle, HeartShine, Suitcase } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import type { LeadItem } from "@/lib/queries/leads";
import type { LeadStatusItem } from "@/lib/queries/leads";

function formatEventDate(date: Date | string | null): string {
  if (!date) return "—";
  return format(new Date(date), "d MMM yyyy");
}

interface LeadsPipelineViewProps {
  leads: LeadItem[];
  statuses: LeadStatusItem[];
  onDragEnd: (result: DropResult) => void;
  onEdit: (lead: LeadItem) => void;
  onMarkDeal: (lead: LeadItem) => void;
  onMarkLost: (lead: LeadItem) => void;
  onCreateBooking: (lead: LeadItem) => void;
  isLoading?: boolean;
}

export function LeadsPipelineView({
  leads,
  statuses,
  onDragEnd,
  onEdit,
  onMarkDeal,
  onMarkLost,
  onCreateBooking,
  isLoading,
}: LeadsPipelineViewProps) {
  if (isLoading) {
    return (
      <div className="overflow-x-auto px-4 sm:px-6 py-4">
        <div className="flex gap-4 min-w-max">
          {statuses.map((status) => (
            <div key={status.id} className="w-72 shrink-0 flex flex-col rounded-lg border border-border bg-muted/20">
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
                <Skeleton className="h-2.5 w-2.5 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="flex-1 p-2 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 w-full rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="overflow-x-auto px-4 sm:px-6 py-4">
        <div className="flex gap-4 min-w-max">
          {statuses.map((status) => {
            const columnLeads = leads.filter((l) => l.status.id === status.id);
            const columnPax = columnLeads.reduce((sum, l) => sum + (l.estimatedPax ?? 0), 0);
            return (
              <Droppable
                key={status.id}
                droppableId={status.id}
                isDropDisabled={status.isSystem}
              >
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "w-72 shrink-0 flex flex-col rounded-lg border border-border bg-muted/20 transition-colors",
                      snapshot.isDraggingOver && !status.isSystem && "bg-muted/50 border-foreground/40"
                    )}
                    aria-label={`Kolom ${status.name}, ${columnLeads.length} lead`}
                  >
                    {/* Column Header */}
                    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
                      <span
                        aria-hidden="true"
                        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: status.color }}
                      />
                      <span className="text-sm font-semibold">{status.name}</span>
                      <span className="text-xs text-muted-foreground">
                        · {columnPax.toLocaleString("id-ID")} pax
                      </span>
                      <span className="ml-auto text-xs font-medium text-muted-foreground bg-background border border-border rounded-full px-2 py-0.5">
                        {columnLeads.length}
                      </span>
                    </div>

                    {/* Cards */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[calc(100vh-22rem)]">
                      {columnLeads.length === 0 && !snapshot.isDraggingOver ? (
                        <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                          Tidak ada lead
                        </div>
                      ) : (
                        columnLeads.map((lead, idx) => {
                          const firstContact = Array.isArray(lead.contactNumbers)
                            ? (lead.contactNumbers[0] as { number?: string } | undefined)?.number ?? ""
                            : "";
                          return (
                            <Draggable key={lead.id} draggableId={lead.id} index={idx}>
                              {(dragProvided, dragSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  className={cn(
                                    "rounded-lg border border-border bg-background p-3 space-y-2 transition-shadow cursor-grab active:cursor-grabbing",
                                    dragSnapshot.isDragging
                                      ? "shadow-lg ring-2 ring-ring"
                                      : "hover:shadow-sm"
                                  )}
                                  onClick={() => {
                                    if (!dragSnapshot.isDragging) {
                                      onEdit(lead);
                                    }
                                  }}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium truncate">{lead.name}</p>
                                      {firstContact && (
                                        <p className="text-xs text-muted-foreground">+{firstContact}</p>
                                      )}
                                    </div>
                                    {lead.eventType && (
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "text-[10px] shrink-0",
                                          lead.eventType.category === "MICE" && "bg-muted"
                                        )}
                                      >
                                        {lead.eventType.category === "MICE" ? "MICE" : "Wedding"}
                                      </Badge>
                                    )}
                                  </div>

                                  <div className="space-y-1 text-xs text-muted-foreground">
                                    <div className="flex justify-between">
                                      <span>Venue</span>
                                      <span className="text-foreground font-medium truncate ml-2">
                                        {lead.venue?.name ?? "—"}
                                      </span>
                                    </div>
                                    {lead.eventType && (
                                      <div className="flex justify-between">
                                        <span>Event</span>
                                        <span className="text-foreground font-medium truncate ml-2">
                                          {lead.eventType.name}
                                        </span>
                                      </div>
                                    )}
                                    <div className="flex justify-between">
                                      <span>Tanggal</span>
                                      <span className="text-foreground font-medium">
                                        {formatEventDate(lead.eventDate)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Pax</span>
                                      <span className="text-foreground font-medium">
                                        {lead.estimatedPax
                                          ? lead.estimatedPax.toLocaleString("id-ID")
                                          : "—"}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between pt-1 border-t border-border">
                                    <span className="text-xs text-muted-foreground">
                                      {lead.assignedTo
                                        ? (lead.assignedTo.nickName ?? lead.assignedTo.fullName ?? "—")
                                        : (lead.createdBy.nickName ?? lead.createdBy.fullName ?? "—")}
                                    </span>
                                    {lead.package ? (
                                      <Badge variant="secondary" className="text-[10px]">
                                        {lead.package.packageName}
                                      </Badge>
                                    ) : (
                                      <span className="text-[10px] text-muted-foreground">
                                        No package
                                      </span>
                                    )}
                                  </div>
                                  {/* Deal / Lost quick actions — only for non-final leads */}
                                  {!lead.status.isFinal && (
                                    <div className="space-y-1 pt-1 border-t border-border">
                                      <div className="flex gap-1">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="flex-1 h-7 text-[10px] px-2 hover:bg-primary/10"
                                          onClick={(e) => { e.stopPropagation(); onMarkDeal(lead); }}
                                          aria-label={`Tandai ${lead.name} sebagai Deal`}
                                        >
                                          <CheckCircle weight="BoldDuotone" aria-hidden="true" className="h-3 w-3 mr-1 shrink-0" />
                                          Deal
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="flex-1 h-7 text-[10px] px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                          onClick={(e) => { e.stopPropagation(); onMarkLost(lead); }}
                                          aria-label={`Tandai ${lead.name} sebagai Lost`}
                                        >
                                          <CloseCircle weight="BoldDuotone" aria-hidden="true" className="h-3 w-3 mr-1 shrink-0" />
                                          Lost
                                        </Button>
                                      </div>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="w-full h-7 text-[10px] px-2 hover:bg-accent"
                                        onClick={(e) => { e.stopPropagation(); onCreateBooking(lead); }}
                                        aria-label={`Buat booking untuk ${lead.name}`}
                                      >
                                        {(lead.eventType?.category ?? lead.category) === "MICE" ? (
                                          <Suitcase weight="BoldDuotone" aria-hidden="true" className="h-3 w-3 mr-1 shrink-0" />
                                        ) : (
                                          <HeartShine weight="BoldDuotone" aria-hidden="true" className="h-3 w-3 mr-1 shrink-0" />
                                        )}
                                        {(lead.eventType?.category ?? lead.category) === "MICE" ? "Create Booking MICE" : "Create Booking Wedding"}
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          );
                        })
                      )}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </div>
    </DragDropContext>
  );
}
