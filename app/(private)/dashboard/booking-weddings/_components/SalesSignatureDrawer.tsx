"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import SignatureCanvas from "react-signature-canvas";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useMySignature } from "@/hooks/use-my-signature";
import { editBooking } from "@/actions/booking";

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
// Body without a Sheet of its own, so it can be embedded inside another drawer's
// single Sheet (the edit-booking continue flow).

export function SalesSignatureContent({
  bookingId,
  onDone,
  onPrevious,
}: {
  bookingId: string;
  onDone: () => void;
  onPrevious?: () => void;
}): React.ReactElement {
  const qc = useQueryClient();
  const { defaultSignature } = useMySignature();

  const sigRef = useRef<SignatureCanvas>(null);
  const [signingLocation, setSigningLocation] = useState("");
  const [useDefault, setUseDefault] = useState(false);
  const [drawnSig, setDrawnSig] = useState("");
  const [saving, setSaving] = useState(false);

  const finalSig = useDefault ? (defaultSignature ?? "") : drawnSig;
  const canSave = !!signingLocation.trim() && !!finalSig;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const r = await editBooking({ id: bookingId, signingLocation, signatureSales: finalSig });
      if (!r.success) { toast.error(r.error); return; }
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["booking-detail", bookingId] });
      toast.success("Tanda tangan tersimpan");
      onDone();
    } finally {
      setSaving(false);
    }
  }

  function handleSkip() {
    onDone();
  }

  return (
    <div className="flex flex-col gap-4 px-1 pb-4">
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

        {defaultSignature && (
          <div className="flex items-center gap-2">
            <Switch
              id="use-default"
              checked={useDefault}
              onCheckedChange={(v) => { setUseDefault(v); setDrawnSig(""); }}
            />
            <Label htmlFor="use-default" className="text-sm">Gunakan tanda tangan tersimpan</Label>
          </div>
        )}

        {useDefault && defaultSignature ? (
          <div className="rounded-xl border border-border bg-white p-3 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={defaultSignature} alt="tanda tangan default" className="max-h-28 object-contain" />
          </div>
        ) : (
          <>
            <div className={cn("border-2 border-dashed rounded-xl overflow-hidden bg-muted", !drawnSig ? "border-destructive/40" : "border-border")}>
              <SignatureCanvas
                ref={sigRef}
                penColor="black"
                canvasProps={{ width: 460, height: 160, className: "w-full" }}
                onEnd={() => setDrawnSig(sigRef.current?.toDataURL() ?? "")}
              />
            </div>
            <div className="flex items-center justify-between">
              {!drawnSig && <p className="text-xs text-destructive">Tanda tangan wajib diisi</p>}
              <button
                type="button"
                onClick={() => { sigRef.current?.clear(); setDrawnSig(""); }}
                className="text-xs text-destructive underline ml-auto"
              >
                Hapus tanda tangan
              </button>
            </div>
          </>
        )}

        <div className="flex gap-2 pt-2">
          {onPrevious && (
            <Button type="button" variant="outline" onClick={onPrevious} className="flex-1 rounded-xl">
              Previous
            </Button>
          )}
          <Button type="button" variant="outline" onClick={handleSkip} className="flex-1 rounded-xl">
            Lewati
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || !canSave} className="flex-1 rounded-xl">
            {saving ? "Menyimpan..." : "Selesai"}
          </Button>
        </div>
    </div>
  );
}
