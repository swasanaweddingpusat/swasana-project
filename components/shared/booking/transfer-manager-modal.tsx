"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CloseCircle as X } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { useTransferBookingManager } from "@/hooks/use-bookings";
import { useManagers } from "@/hooks/use-managers";
import type { BookingListItem } from "@/lib/queries/bookings";

export interface TransferManagerModalProps {
  open: boolean;
  booking: BookingListItem | null;
  onClose: () => void;
}

export function TransferManagerModal({
  open,
  booking,
  onClose,
}: TransferManagerModalProps): React.JSX.Element | null {
  const transferManagerMut = useTransferBookingManager();
  const { managers } = useManagers();
  const [selectedManagerId, setSelectedManagerId] = useState("");

  if (!open || !booking) return null;

  function handleClose(): void {
    setSelectedManagerId("");
    onClose();
  }

  return (
    <div className={cn("fixed", "inset-0", "z-50", "flex", "items-center", "justify-center", "bg-black/40", "p-4")}>
      <div className={cn("bg-card", "rounded-2xl", "shadow-xl", "w-full", "max-w-md", "p-4", "sm:p-6", "relative")}>
        <div className={cn("flex", "items-start", "justify-between", "gap-4", "mb-6")}>
          <div>
            <h2 className={cn("text-lg", "font-bold", "text-foreground")}>Transfer Manager</h2>
            <p className={cn("text-sm", "text-muted-foreground", "mt-1")}>
              Memindahkan penugasan manager pada booking ini ke manager yang dipilih.
            </p>
          </div>
          <button
            className={cn("rounded-full", "bg-muted", "hover:bg-muted/80", "p-1.5", "shrink-0")}
            onClick={handleClose}
            type="button"
            aria-label="Tutup"
          >
            <X weight="BoldDuotone" className={cn("h-5", "w-5", "text-foreground")} />
          </button>
        </div>

        <div className="mb-4">
          <p className={cn("text-xs", "text-muted-foreground", "mb-1")}>Manager saat ini</p>
          <div className={cn("flex", "items-center", "gap-2")}>
            <span className={cn("text-sm", "font-medium", "text-foreground")}>
              {booking.manager?.fullName ?? (
                <span className={cn("text-muted-foreground", "italic")}>Belum ada</span>
              )}
            </span>
            {booking.manager?.fullName && (
              <span
                className={cn(
                  "text-xs",
                  "px-2",
                  "py-0.5",
                  "rounded-full",
                  "border",
                  "border-border",
                  "bg-muted",
                  "text-muted-foreground",
                )}
              >
                manager
              </span>
            )}
          </div>
        </div>

        <div>
          <p className={cn("text-xs", "text-muted-foreground", "mb-1")}>Pilih Manager</p>
          <SearchableSelect
            options={managers
              .filter((m) => m.role?.name === "manager" && m.id !== booking.manager?.id)
              .map((m) => ({ id: m.id, name: m.fullName ?? m.id, badge: "manager" }))}
            value={selectedManagerId}
            onChange={setSelectedManagerId}
            placeholder="Pilih manager tujuan..."
            searchPlaceholder="Cari nama manager..."
            emptyText="Manager tidak ditemukan"
            className="w-full"
          />
        </div>

        <div className={cn("flex", "gap-3", "mt-6")}>
          <button
            className={cn(
              "flex-1",
              "border",
              "border-border",
              "rounded-lg",
              "py-2",
              "font-medium",
              "hover:bg-accent",
              "transition",
              "text-sm",
            )}
            onClick={handleClose}
            disabled={transferManagerMut.isPending}
            type="button"
          >
            Batal
          </button>
          <button
            className={cn(
              "flex-1",
              "bg-primary",
              "text-primary-foreground",
              "rounded-lg",
              "py-2",
              "font-medium",
              "hover:bg-primary/90",
              "transition",
              "text-sm",
              "disabled:opacity-50",
              "disabled:cursor-not-allowed",
            )}
            disabled={!selectedManagerId || transferManagerMut.isPending}
            type="button"
            onClick={async () => {
              const r = await transferManagerMut.mutateAsync({
                bookingId: booking.id,
                targetManagerId: selectedManagerId,
              });
              if (!r.success) {
                toast.error(r.error);
              } else {
                toast.success("Manager berhasil ditransfer");
                handleClose();
              }
            }}
          >
            {transferManagerMut.isPending ? "Mentransfer..." : "Transfer Manager"}
          </button>
        </div>
      </div>
    </div>
  );
}
