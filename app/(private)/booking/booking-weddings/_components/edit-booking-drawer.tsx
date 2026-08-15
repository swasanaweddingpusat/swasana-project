"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/shared/drawer";
import { ApprovalWarningDialog } from "@/components/shared/approval-warning-dialog";
import { Button } from "@/components/ui/button";
import { SalesSignatureContent } from "./SalesSignatureDrawer";
import { EditTopContentById } from "./edit-top-drawer";
import { EditPaymentContentById } from "./EditPaymentStep";
import { EditTakeoutContent } from "./EditTakeoutDrawer";
import { EditPackageItemsContent } from "./EditPackageItemsDrawer";
import { EditComplimentaryContent, type ComplimentaryHandle } from "./EditComplimentaryDrawer";
import { useEditBookingForm, STEP_LABELS } from "./_edit-booking/useEditBookingForm";
import { ClientInfoStep } from "./_edit-booking/ClientInfoStep";
import { VenueEventStep } from "./_edit-booking/VenueEventStep";
import type { BookingListItem } from "@/lib/queries/bookings";

// â”€â”€â”€ Props â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface Props {
  booking: BookingListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// â”€â”€â”€ EditBookingDrawer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function EditBookingDrawer({ booking, open, onOpenChange }: Props) {
  const form = useEditBookingForm(booking, open, onOpenChange);

  const {
    currentStep,
    linearMode,
    isSavingClientInfo,
    isSubmitting,
    isStep1Complete,
    isStep2Complete,
    hasVenueTabChange,
    willResetApproval,
    showSubmitConfirm,
    setShowSubmitConfirm,
    hideCloseButton,
    drawerTitle,
    stepHeader,
    handleSaveClientInfo,
    handleSubmit,
    handleGoToStep,
    handleCloseAll,
    setContinueFlowStep,
  } = form;

  // Ref to the embedded complimentary editor in step 2
  const complimentaryRef = useRef<ComplimentaryHandle>(null);

  // â”€â”€â”€ Step 2 save: editBooking first, then complimentary if dirty â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function handleStep2Save() {
    // If the edit will trigger re-approval (venue/package/date changed on a signed
    // booking), show a strong warning first instead of firing the mutation immediately.
    if (willResetApproval) {
      setShowSubmitConfirm(true);
      return;
    }
    // Run the existing editBooking handler (sets linearMode + advances to step 3
    // if venue changed, or stays on step 2 with updated originals if unchanged).
    await handleSubmit();
    // After editBooking succeeds, check if complimentary section has unsaved changes.
    // We only attempt this when NOT entering linear mode (i.e., no venue change),
    // because in linear mode the user is forwarded to step 3 immediately.
    if (!hasVenueTabChange && complimentaryRef.current?.isDirty()) {
      await complimentaryRef.current.save();
    }
  }

  // â”€â”€â”€ Free-mode per-tab save handlers for steps 3â€“5 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // In free mode, onClose is a no-op â€” the content already called toast.success
  // and invalidated queries inside handleSave. We stay on the same tab.
  function noOp() { /* stay on tab */ }

  // â”€â”€â”€ Linear mode advance handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function advanceTo(step: number) {
    setContinueFlowStep(
      step === 3 ? "package-items" :
      step === 4 ? "takeout" :
      step === 5 ? "top" :
      step === 6 ? "payment" :
      "signature",
    );
  }

  return (
    <Drawer
      isOpen={open}
      onClose={handleCloseAll}
      isCloseButton={!hideCloseButton}
      title={drawerTitle}
      maxWidth="sm:max-w-5xl"
      paddingX="px-1 sm:px-2"
      headerActions={<span className="text-sm text-muted-foreground">{stepHeader}</span>}
    >
      <div className={cn("flex flex-col sm:flex-row", "h-full", "gap-2", "sm:gap-3")}>

        {/* â”€â”€â”€ Step Rail: horizontal strip on mobile, vertical on desktop â”€â”€â”€ */}
        <nav
          aria-label="Langkah edit booking"
          className="shrink-0 border-b border-border pb-2 sm:w-16 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-1.5"
        >
          <ol className="flex flex-row gap-0.5 sm:flex-col">
            {([1, 2, 3, 4, 5, 6, 7] as number[]).map((step) => {
              const isActive = currentStep === step;
              return (
                <li key={step} className="flex-1 sm:flex-none">
                  <button
                    type="button"
                    onClick={() => handleGoToStep(step)}
                    disabled={linearMode}
                    aria-current={isActive ? "step" : undefined}
                    title={STEP_LABELS[step]}
                    className={cn(
                      "group flex w-full flex-col items-center gap-1 rounded-lg px-0.5 py-1.5 text-center transition-colors",
                      isActive ? "bg-accent" : "hover:bg-accent/60",
                      linearMode && "cursor-not-allowed",
                      linearMode && !isActive && "opacity-40",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition-colors",
                        isActive
                          ? "bg-[var(--brand-gold)] text-[var(--brand-ink)]"
                          : "border border-border bg-background text-muted-foreground group-hover:border-foreground/40",
                      )}
                    >
                      {step}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] leading-tight",
                        isActive ? "font-semibold text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {STEP_LABELS[step]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* â”€â”€â”€ Right column: body + footer â”€â”€â”€ */}
        <div className="flex flex-1 flex-col min-w-0">

        {/* â”€â”€â”€ Step Body â”€â”€â”€ */}
        <div
          className={cn("flex-1", "overflow-y-auto", "px-1")}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.shiftKey) return;
            const target = e.target as HTMLElement;
            if (target.tagName === "TEXTAREA") return;
            if (target.closest("[role='listbox']") || target.closest("[role='option']")) return;
            e.preventDefault();
            if (currentStep === 1 && isStep1Complete && !isSavingClientInfo) {
              void handleSaveClientInfo();
            } else if (currentStep === 2 && isStep2Complete && !isSubmitting) {
              void handleStep2Save();
            }
          }}
        >
          {currentStep === 1 && <ClientInfoStep form={form} />}

          {currentStep === 2 && (
            <>
              <VenueEventStep form={form} />
              {/* Complimentary section embedded at bottom of step 2 */}
              {booking && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-semibold text-foreground px-1">Complimentary</p>
                  <EditComplimentaryContent
                    ref={complimentaryRef}
                    bookingId={booking.id}
                    onClose={noOp}
                    hideActions
                  />
                </div>
              )}
            </>
          )}

          {currentStep === 3 && booking && (
            <EditPackageItemsContent
              active
              bookingId={booking.id}
              onClose={linearMode ? () => advanceTo(4) : noOp}
              saveLabel={linearMode ? "Continue" : "Simpan"}
            />
          )}

          {currentStep === 4 && booking && (
            <EditTakeoutContent
              active
              bookingId={booking.id}
              onClose={linearMode ? () => advanceTo(5) : noOp}
              saveLabel={linearMode ? "Continue" : "Simpan"}
            />
          )}

          {currentStep === 5 && booking && (
            <EditTopContentById
              active
              bookingId={booking.id}
              onSaved={linearMode ? () => advanceTo(6) : undefined}
              saveLabel={linearMode ? "Continue" : "Simpan"}
            />
          )}

          {currentStep === 6 && booking && (
            <EditPaymentContentById
              active
              bookingId={booking.id}
              onSaved={linearMode ? () => advanceTo(7) : noOp}
              saveLabel={linearMode ? "Continue" : "Simpan"}
            />
          )}

          {currentStep === 7 && booking && (
            <SalesSignatureContent
              bookingId={booking.id}
              onDone={linearMode ? handleCloseAll : noOp}
              isSalesPIC={form.isSalesPIC}
            />
          )}
        </div>

        {/* â”€â”€â”€ Footer (only for steps 1 & 2) â”€â”€â”€ */}
        {(currentStep === 1 || currentStep === 2) && (
          <div className="bg-background sticky bottom-0 z-10">
            {currentStep === 2 && hasVenueTabChange && (
              <p className="px-1 pb-1 text-xs text-muted-foreground">
                Simpan untuk lanjut ke Item Paket â†’ Takeout â†’ TOP â†’ Payment â†’ Tanda Tangan.
              </p>
            )}
            <div className="flex py-4 gap-2">
              {currentStep === 1 ? (
                <Button
                  onClick={handleSaveClientInfo}
                  disabled={isSavingClientInfo || !isStep1Complete}
                  className={cn("w-full cursor-pointer", (isSavingClientInfo || !isStep1Complete) && "opacity-50 cursor-not-allowed")}
                >
                  {isSavingClientInfo ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              ) : (
                <Button
                  onClick={handleStep2Save}
                  disabled={!isStep2Complete || isSubmitting}
                  className={cn(
                    "w-full cursor-pointer",
                    (!isStep2Complete || isSubmitting) && "opacity-50 cursor-not-allowed",
                  )}
                >
                  {isSubmitting ? "Menyimpan..." : hasVenueTabChange ? "Continue" : "Simpan"}
                </Button>
              )}
            </div>
          </div>
        )}
        </div>
      </div>

      <ApprovalWarningDialog
        open={showSubmitConfirm}
        onOpenChange={setShowSubmitConfirm}
        title="Perubahan Akan Memicu Approval Ulang"
        description="Booking ini sudah ditandatangani klien. Mengubah venue, paket, atau tanggal event akan membatalkan persetujuan yang sudah berjalan."
        warnings={[
          "Approval akan di-reset ke Pending — Sales, Manager, dan Finance wajib menyetujui ulang dari awal.",
          "Tanda tangan Manager harus di-approve ulang untuk mengecek kembali setiap perubahan yang terjadi pada booking ini.",
          "Persetujuan klien akan dibatalkan dan klien harus menandatangani ulang kontraknya.",
          "Perubahan ini membuka revisi baru; pastikan seluruh perbedaan sudah diperiksa sebelum melanjutkan.",
        ]}
        confirmLabel="Ya, Lanjutkan Perubahan"
        onConfirm={() => {
          setShowSubmitConfirm(false);
          void handleSubmit();
        }}
        submitting={isSubmitting}
      />
    </Drawer>
  );
}

