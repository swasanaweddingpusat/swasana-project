"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Gallery } from "@solar-icons/react";
import type { FileDescriptor } from "@/lib/validations/common";
import { resolveAttendancePhotoUrl } from "@/lib/attendance-photo";
import type { LeaveRequestItem } from "@/lib/queries/leaveRequests";

interface LeaveEvidenceModalProps {
  request: LeaveRequestItem | null;
  onClose: () => void;
}

export function LeaveEvidenceModal({ request, onClose }: LeaveEvidenceModalProps) {
  const url = resolveAttendancePhotoUrl((request?.evidence ?? null) as FileDescriptor | null);

  return (
    <Dialog open={!!request} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gallery weight="BoldDuotone" className="h-5 w-5" />
            Bukti Cuti — {request?.profile.fullName ?? ""}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-hidden rounded-xl bg-muted">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Bukti cuti" className="max-h-[70vh] w-full object-contain" />
          ) : (
            <div className="flex aspect-[3/4] items-center justify-center">
              <p className="text-xs text-muted-foreground">Tidak ada bukti</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
