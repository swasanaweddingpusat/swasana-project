"use client";

import { cn } from "@/lib/utils";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { SalesSignatureContent } from "./SalesSignatureDrawer";
import { EditTopContentById } from "./edit-top-drawer";
import { EditTakeoutContent } from "./EditTakeoutDrawer";
import { EditPackageItemsContent } from "./EditPackageItemsDrawer";
import { useEditBookingForm, STEP_LABELS } from "./_edit-booking/useEditBookingForm";
import { ClientInfoStep } from "./_edit-booking/ClientInfoStep";
import { VenueEventStep } from "./_edit-booking/VenueEventStep";
import type { BookingListItem } from "@/lib/queries/bookings";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  booking: BookingListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── EditBookingDrawer ────────────────────────────────────────────────────────

export function EditBookingDrawer({ booking, open, onOpenChange }: Props) {
  const form = useEditBookingForm(booking, open, onOpenChange);

  const {
    currentStep,
    continueFlowStep,
    setContinueFlowStep,
    isSavingClientInfo,
    isSubmitting,
    isStep1Complete,
    isStep2Complete,
    hasVenueTabChange,
    hideCloseButton,
    drawerTitle,
    stepHeader,
    handleSaveClientInfo,
    handleSubmit,
    handlePrevious,
    handleGoToStep,
    handleCloseAll,
  } = form;

  return (
    <Drawer
      isOpen={open}
      onClose={handleCloseAll}
      isCloseButton={!hideCloseButton}
      title={drawerTitle}
      maxWidth="sm:max-w-xl"
      headerActions={<span className="text-sm text-muted-foreground">{stepHeader}</span>}
    >
      {continueFlowStep === null && (
        <div className={cn("flex", "flex-col", "justify-between", "h-full")}>

          {/* ─── Tab Navigator ─── */}
          <div className="mb-3 shrink-0 overflow-x-auto border-b scrollbar-none">
            <div className="flex w-max min-w-full gap-1">
              {([1, 2] as number[]).map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => handleGoToStep(step)}
                  className={cn(
                    "relative shrink-0 whitespace-nowrap px-3 py-2 text-xs font-medium transition-colors",
                    "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:transition-colors",
                    currentStep === step
                      ? "text-foreground after:bg-primary"
                      : "text-muted-foreground after:bg-transparent hover:text-foreground",
                  )}
                >
                  {STEP_LABELS[step]}
                </button>
              ))}
            </div>
          </div>

          {/* ─── Step Body ─── */}
          <div
            className={cn("flex-1", "overflow-y-auto", "px-2")}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.shiftKey) return;
              const target = e.target as HTMLElement;
              if (target.tagName === "TEXTAREA") return;
              if (target.closest("[role='listbox']") || target.closest("[role='option']")) return;
              e.preventDefault();
              if (currentStep === 1 && isStep1Complete && !isSavingClientInfo) {
                void handleSaveClientInfo();
              } else if (currentStep === 2 && isStep2Complete && !isSubmitting) {
                void handleSubmit();
              }
            }}
          >
            {currentStep === 1 && <ClientInfoStep form={form} />}
            {currentStep === 2 && <VenueEventStep form={form} />}
          </div>

          {/* ─── Footer ─── */}
          <div className="bg-background sticky bottom-0 z-10">
            {currentStep === 2 && hasVenueTabChange && (
              <p className="px-1 pb-1 text-xs text-muted-foreground">
                Lanjut ke Item Paket → Takeout → TOP → Tanda Tangan.
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
                <>
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={isSubmitting}
                    className="flex-[40%] cursor-pointer"
                  >
                    Previous
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={!isStep2Complete || isSubmitting}
                    className={cn(
                      "flex-[60%] cursor-pointer",
                      (!isStep2Complete || isSubmitting) && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    {isSubmitting ? "Menyimpan..." : hasVenueTabChange ? "Continue" : "Simpan"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Continue flow: item paket → takeout → top → signature ─── */}
      {booking && continueFlowStep === "package-items" && (
        <EditPackageItemsContent
          active
          bookingId={booking.id}
          onClose={() => setContinueFlowStep("takeout")}
          onPrevious={() => setContinueFlowStep(null)}
        />
      )}
      {booking && continueFlowStep === "takeout" && (
        <EditTakeoutContent
          active
          bookingId={booking.id}
          onClose={() => setContinueFlowStep("top")}
          onPrevious={() => setContinueFlowStep("package-items")}
        />
      )}
      {booking && continueFlowStep === "top" && (
        <EditTopContentById
          active
          bookingId={booking.id}
          onSaved={() => setContinueFlowStep("signature")}
          onPrevious={() => setContinueFlowStep("takeout")}
          saveLabel="Continue"
        />
      )}
      {booking && continueFlowStep === "signature" && (
        <SalesSignatureContent
          bookingId={booking.id}
          onDone={handleCloseAll}
          onPrevious={() => setContinueFlowStep("top")}
          isSalesPIC={form.isSalesPIC}
        />
      )}
    </Drawer>
  );
}
