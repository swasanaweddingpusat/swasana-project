"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import SignatureCanvas from "react-signature-canvas";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useMySignature } from "@/hooks/use-my-signature";
import { updateBookingSignature } from "@/actions/booking";
import { validateBookingField } from "@/lib/validations/booking-form";
import type { BookingDetail } from "@/lib/queries/bookings";

interface Props {
  isOpen: boolean;
  bookingId: string;
  onDone: () => void;
  onPrevious?: () => void;
  step?: number;
  totalSteps?: number;
}

export function SalesSignatureDrawer({ isOpen, bookingId, onDone, onPrevious, step, totalSteps }: Props): React.ReactElement {
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onDone}
      title="Tanda Tangan Sales"
      headerActions={step && totalSteps ? (
        <span className="text-sm text-muted-foreground">Step {step} / {totalSteps}</span>
      ) : undefined}
    >
      <SalesSignatureContent bookingId={bookingId} onDone={onDone} onPrevious={onPrevious} />
    </Drawer>
  );
}

// ─── Content (no Drawer shell) ──────────────────────────────────────────────────
// Fetches the booking detail so the signing location + already-saved sales
// signature auto-populate from the DB, then renders the form body. The body has
// its own Sheet-less markup so it can embed inside the edit-booking single-Sheet
// continue flow.

export function SalesSignatureContent({
  bookingId,
  onDone,
  onPrevious,
  isSalesPIC = false,
}: {
  bookingId: string;
  onDone: () => void;
  onPrevious?: () => void;
  /** Only the sales PIC may sign. When false, signature fields are hidden and
   *  the step can only be skipped or submitted without a signature. */
  isSalesPIC?: boolean;
}): React.ReactElement {
  const { data: booking, isLoading } = useQuery<BookingDetail>({
    queryKey: ["booking-detail", bookingId],
    queryFn: async () => {
      const res = await fetch(`/api/bookings/${bookingId}`);
      if (!res.ok) throw new Error("Failed to fetch booking detail");
      return res.json() as Promise<BookingDetail>;
    },
    enabled: !!bookingId,
    staleTime: 30_000,
  });

  if (isLoading || !booking) {
    return (
      <div className="flex flex-col gap-4 px-1 pb-4">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-52 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <SalesSignatureBody
      key={bookingId}
      bookingId={bookingId}
      initialLocation={booking.signingLocation ?? ""}
      initialSignature={booking.salesSignature ?? ""}
      onDone={onDone}
      onPrevious={onPrevious}
      isSalesPIC={isSalesPIC}
    />
  );
}

// ─── Body ─────────────────────────────────────────────────────────────────────
// State seeds once from props; the parent passes key={bookingId} so it remounts
// fresh whenever the booking changes.

function SalesSignatureBody({
  bookingId,
  initialLocation,
  initialSignature,
  onDone,
  onPrevious,
  isSalesPIC,
}: {
  bookingId: string;
  initialLocation: string;
  initialSignature: string;
  onDone: () => void;
  onPrevious?: () => void;
  isSalesPIC: boolean;
}): React.ReactElement {
  const qc = useQueryClient();
  const { defaultSignature } = useMySignature();

  const sigRef = useRef<SignatureCanvas>(null);
  const [signingLocation, setSigningLocation] = useState(initialLocation);
  const [useDefault, setUseDefault] = useState(false);
  const [drawnSig, setDrawnSig] = useState("");
  // Signature already stored on this booking (pre-filled from DB). Shown as a
  // preview and reused on save unless the user redraws or picks the profile default.
  const [existingSig] = useState(initialSignature);
  const [redraw, setRedraw] = useState(false);
  const [saving, setSaving] = useState(false);

  // Effective signature: profile default > freshly drawn (when redrawing) > the
  // existing DB signature > a fresh drawing (when there was no existing one).
  const finalSig = useDefault
    ? (defaultSignature ?? "")
    : redraw
      ? drawnSig
      : (existingSig || drawnSig);

  // Sales PIC: must fill location + signature. Non-sales: location only.
  const canSave = !!signingLocation.trim() && (isSalesPIC ? !!finalSig : true);

  async function handleSave() {
    if (!canSave) return;
    const locErr = validateBookingField("signingLocation", signingLocation);
    if (locErr) { toast.error(locErr); return; }
    setSaving(true);
    try {
      const payload = isSalesPIC
        ? { id: bookingId, signingLocation, signatureSales: finalSig }
        : { id: bookingId, signingLocation };
      const r = await updateBookingSignature(payload);
      if (!r.success) { toast.error(r.error); return; }
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["booking-detail", bookingId] });
      toast.success(isSalesPIC ? "Tanda tangan tersimpan" : "Lokasi tanda tangan tersimpan");
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-1 pb-4">
        {/* Lokasi tanda tangan — wajib diisi oleh siapapun */}
        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">
            Lokasi Tanda Tangan <span className="text-destructive">*</span>
          </label>
          <Input
            placeholder="Contoh: Jakarta, Bandung..."
            value={signingLocation}
            onChange={(e) => setSigningLocation(e.target.value)}
          />
        </div>

        {/* Signature pad — hanya untuk sales PIC */}
        {isSalesPIC ? (
          <>
            {defaultSignature && (
              <div className="flex items-center gap-2">
                <Switch
                  id="use-default"
                  checked={useDefault}
                  onCheckedChange={(v) => { setUseDefault(v); setDrawnSig(""); setRedraw(false); }}
                />
                <Label htmlFor="use-default" className="text-sm">Gunakan tanda tangan tersimpan (profil)</Label>
              </div>
            )}

            {useDefault && defaultSignature ? (
              <div className="rounded-xl border border-border bg-white p-3 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={defaultSignature} alt="tanda tangan default" className="max-h-28 object-contain" />
              </div>
            ) : existingSig && !redraw ? (
              // Signature already saved on this booking — show it, allow redraw.
              <div className="rounded-xl border border-border bg-white p-3 flex flex-col items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={existingSig} alt="tanda tangan tersimpan" className="max-h-28 object-contain" />
                <button
                  type="button"
                  onClick={() => { setRedraw(true); setDrawnSig(""); }}
                  className="text-xs text-primary underline"
                >
                  Gambar ulang tanda tangan
                </button>
              </div>
            ) : (
              <>
                <div className={cn("border-2 border-dashed rounded-xl overflow-hidden bg-muted", !drawnSig ? "border-destructive/40" : "border-border")}>
                  <SignatureCanvas
                    ref={sigRef}
                    penColor="black"
                    canvasProps={{ className: "w-full", style: { width: "100%", height: 200, touchAction: "none" } }}
                    onEnd={() => setDrawnSig(sigRef.current?.toDataURL("image/png") ?? "")}
                  />
                </div>
                <div className="flex items-center justify-between">
                  {!drawnSig && <p className="text-xs text-destructive">Tanda tangan wajib diisi</p>}
                  <div className="ml-auto flex items-center gap-3">
                    {existingSig && (
                      <button
                        type="button"
                        onClick={() => { sigRef.current?.clear(); setDrawnSig(""); setRedraw(false); }}
                        className="text-xs text-muted-foreground underline"
                      >
                        Batal, pakai yang lama
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { sigRef.current?.clear(); setDrawnSig(""); }}
                      className="text-xs text-destructive underline"
                    >
                      Hapus tanda tangan
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
            Tanda tangan hanya dapat diisi oleh sales PIC booking ini.
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {onPrevious && (
            <Button type="button" variant="outline" onClick={onPrevious} className="flex-1 rounded-xl">
              Previous
            </Button>
          )}
          <Button type="button" onClick={handleSave} disabled={saving || !canSave} className="flex-1 rounded-xl">
            {saving ? "Menyimpan..." : "Selesai"}
          </Button>
        </div>
    </div>
  );
}
