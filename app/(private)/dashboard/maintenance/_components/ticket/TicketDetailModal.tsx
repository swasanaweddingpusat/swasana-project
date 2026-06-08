"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MaintenanceTicketItem } from "@/lib/queries/maintenance";

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value ?? "—"}</span>
    </div>
  );
}

interface TicketDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: MaintenanceTicketItem | null;
}

export function TicketDetailModal({
  open,
  onOpenChange,
  ticket,
}: TicketDetailModalProps) {
  if (!ticket) return null;

  const assignName =
    ticket.assignedTo?.fullName ?? ticket.assignedTo?.nickName ?? "—";
  const creatorName =
    ticket.createdBy?.fullName ?? ticket.createdBy?.nickName ?? "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogTitle>Detail Ticket</DialogTitle>

        <div className="space-y-0 mt-2">
          <DetailRow label="Venue" value={ticket.venue.name} />
          <DetailRow label="Brand" value={ticket.venue.brand?.name ?? "—"} />
          <DetailRow label="Kategori" value={ticket.category.name} />
          <DetailRow
            label="Prioritas"
            value={
              <span>
                {ticket.priority.name}{" "}
                <span className="text-xs text-muted-foreground">
                  ({ticket.priority.deadlineDays} hari)
                </span>
              </span>
            }
          />
          <DetailRow
            label="Status"
            value={
              <Badge variant="outline" className="text-xs">
                {ticket.status.name}
              </Badge>
            }
          />
          <DetailRow label="Assign To" value={assignName} />
          <DetailRow label="Dibuat Oleh" value={creatorName} />
          <DetailRow label="Estimasi" value={formatDate(ticket.estimateDate)} />
          <DetailRow label="Dibuat" value={formatDate(ticket.createdAt)} />
          <DetailRow label="Diperbarui" value={formatDate(ticket.updatedAt)} />
          <DetailRow label="Vendor" value={ticket.isVendor ? "Ya" : "Tidak"} />
          <DetailRow label="Audit" value={ticket.isAudit ? "Ya" : "Tidak"} />
          <DetailRow label="Deskripsi" value={ticket.description} />
        </div>

        {ticket.images.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium">Foto</p>
            <div className="grid grid-cols-3 gap-2">
              {ticket.images.map((img: { id: string; url: string; fileName: string }) => (
                <a
                  key={img.id}
                  href={img.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <img
                    src={img.url}
                    alt={img.fileName}
                    className="h-24 w-full rounded-lg object-cover border hover:opacity-90 transition-opacity"
                  />
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
