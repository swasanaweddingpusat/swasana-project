"use client";

import React from "react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AgreementPanel } from "./agreement-panel";

export interface AgreementModalProps {
  bookingId: string;
  customerName: string;
  onClose: () => void;
}

export function AgreementModal({ bookingId, customerName, onClose }: AgreementModalProps): React.JSX.Element {
  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialogContent className="sm:max-w-md!" style={{ width: "min(calc(100vw - 2rem), 28rem)" }} onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Client Agreement</AlertDialogTitle>
          <AlertDialogDescription>{customerName}</AlertDialogDescription>
        </AlertDialogHeader>

        <AgreementPanel bookingId={bookingId} onCompleted={onClose} />

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Tutup</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
