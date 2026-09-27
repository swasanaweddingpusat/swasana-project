"use client";

import { useRef, useCallback, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Eraser } from "@solar-icons/react";
import { cn } from "@/lib/utils";

interface SignaturePadProps {
  onSignature: (dataUrl: string | null) => void;
  label?: string;
  className?: string;
}

export function SignaturePad({ onSignature, label = "Tanda Tangan", className }: SignaturePadProps) {
  const sigRef = useRef<SignatureCanvas | null>(null);

  // Canvas defaults to its CSS-rendered size at 1x — on hi-DPI screens that
  // produces a blurry/pixelated signature once exported to dataURL. Scale the
  // backing store by devicePixelRatio so the exported PNG stays crisp.
  const resizeCanvas = useCallback(() => {
    const canvas = sigRef.current?.getCanvas();
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d")?.scale(ratio, ratio);
    sigRef.current?.clear();
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  const handleEnd = useCallback(() => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      onSignature(null);
      return;
    }
    onSignature(sigRef.current.getTrimmedCanvas().toDataURL("image/png"));
  }, [onSignature]);

  const handleClear = useCallback(() => {
    sigRef.current?.clear();
    onSignature(null);
  }, [onSignature]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Button type="button" variant="ghost" size="sm" onClick={handleClear} className="h-7 text-xs text-muted-foreground">
          <Eraser weight="BoldDuotone" className="h-3.5 w-3.5 mr-1" />Hapus
        </Button>
      </div>
      <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white">
        <SignatureCanvas
          ref={sigRef}
          onEnd={handleEnd}
          penColor="black"
          canvasProps={{ className: "w-full h-40 rounded-lg" }}
        />
      </div>
      <p className="text-xs text-muted-foreground text-center">Tanda tangan di area di atas</p>
    </div>
  );
}
