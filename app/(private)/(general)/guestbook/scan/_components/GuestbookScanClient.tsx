"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import jsQR from "jsqr";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirmGuestbookAttendance } from "@/hooks/use-guestbook";
import type { ConfirmAttendanceResult } from "@/actions/guestbook";
import { ArrowLeft, CheckCircle, CloseCircle, Keyboard, QrCode, Restart } from "@solar-icons/react";

function formatDateTime(date: string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function GuestbookScanClient(): React.ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pausedRef = useRef(false);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState("");

  const { mutate: confirmAttendance, data: result, isPending, isError, reset } =
    useConfirmGuestbookAttendance();

  // Dedupe: react-query only hands back a new `result` object reference when a
  // mutation actually resolves, so comparing against the last-seen reference
  // guarantees the toast fires exactly once per scan (not once per re-render).
  const lastToastedResultRef = useRef<ConfirmAttendanceResult | null>(null);
  useEffect(() => {
    if (!result || result === lastToastedResultRef.current) return;
    lastToastedResultRef.current = result;

    if (!result.success) {
      toast.error(result.error ?? "Gagal konfirmasi kehadiran.");
      return;
    }

    if (result.alreadyConfirmed) {
      const confirmedAt = formatDateTime(result.confirmedAt);
      toast.warning(
        `${result.visitorName ?? "Tamu"} sudah hadir sebelumnya, tidak bisa check-in lagi.${
          confirmedAt !== "—" ? ` (${confirmedAt})` : ""
        }`
      );
      return;
    }

    toast.success(`${result.visitorName ?? "Tamu"} berhasil check-in.`);
  }, [result]);

  // Kept in a ref so the mount-once effect below never needs to re-run
  // when the mutation object identity changes across renders.
  const confirmAttendanceRef = useRef(confirmAttendance);
  useEffect(() => {
    confirmAttendanceRef.current = confirmAttendance;
  }, [confirmAttendance]);

  useEffect(() => {
    let cancelled = false;
    let rafId: number | null = null;

    function tick(): void {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!pausedRef.current && video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            const trimmed = code.data.trim();
            if (trimmed) {
              pausedRef.current = true;
              confirmAttendanceRef.current(trimmed);
            }
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    }

    async function startCamera(): Promise<void> {
      setCameraError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          if (cancelled) return;
          setCameraReady(true);
          rafId = requestAnimationFrame(tick);
        }
      } catch {
        if (!cancelled) {
          setCameraError("Tidak dapat mengakses kamera. Pastikan izin kamera sudah diberikan.");
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setCameraReady(false);
    };
  }, []);

  const handleScanAgain = useCallback(() => {
    reset();
    pausedRef.current = false;
    setManualCode("");
    setShowManualEntry(false);
  }, [reset]);

  // Manual code entry reuses the exact same mutation used by the QR scan
  // loop above, so both paths share identical validation/success/error handling.
  const handleManualSubmit = useCallback(() => {
    const trimmed = manualCode.trim();
    if (!trimmed) return;
    pausedRef.current = true;
    confirmAttendance(trimmed);
  }, [manualCode, confirmAttendance]);

  const handleManualCodeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setManualCode(event.target.value);
  }, []);

  const handleManualKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleManualSubmit();
      }
    },
    [handleManualSubmit]
  );

  const showResultPanel = isPending || isError || Boolean(result);

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <QrCode weight="BoldDuotone" className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold text-foreground font-heading">Scan Kehadiran Expo</h1>
            <p className="text-xs text-muted-foreground">
              Arahkan kamera ke QR code tamu untuk konfirmasi kehadiran
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          className="rounded-full text-xs h-8 gap-1.5"
          render={<Link href="/guestbook" />}
        >
          <ArrowLeft weight="BoldDuotone" className="h-3.5 w-3.5" />
          Kembali
        </Button>
      </div>

      <Card className="rounded-2xl overflow-hidden py-0">
        <CardContent className="p-0">
          <div className="relative aspect-square sm:aspect-video bg-muted">
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />

            {!cameraReady && !cameraError && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Memuat kamera...</p>
              </div>
            )}

            {cameraError && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted p-4">
                <div className="flex flex-col items-center gap-2 text-center">
                  <CloseCircle weight="BoldDuotone" className="h-10 w-10 text-destructive" />
                  <p className="text-sm text-destructive">{cameraError}</p>
                </div>
              </div>
            )}

            {!cameraError && cameraReady && !showResultPanel && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-56 w-56 rounded-2xl border-4 border-primary/70" />
              </div>
            )}

            {showResultPanel && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/95 p-4">
                <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5 text-center">
                  {isPending && <p className="text-sm text-muted-foreground">Memproses...</p>}

                  {!isPending && isError && (
                    <>
                      <CloseCircle weight="BoldDuotone" className="h-12 w-12 text-destructive" />
                      <p className="text-sm font-semibold text-destructive">Terjadi kesalahan</p>
                      <p className="text-xs text-muted-foreground">
                        Gagal memproses konfirmasi kehadiran. Coba lagi.
                      </p>
                    </>
                  )}

                  {!isPending && !isError && result && !result.success && (
                    <>
                      <CloseCircle weight="BoldDuotone" className="h-12 w-12 text-destructive" />
                      <p className="text-sm font-semibold text-destructive">
                        {result.error ?? "Kode tidak valid."}
                      </p>
                    </>
                  )}

                  {!isPending && !isError && result && result.success && (
                    <>
                      <CheckCircle weight="BoldDuotone" className="h-12 w-12 text-emerald-600" />
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-bold text-foreground">{result.visitorName}</p>
                        {result.companyName && (
                          <p className="text-xs text-muted-foreground">{result.companyName}</p>
                        )}
                        <span
                          className={
                            result.alreadyConfirmed
                              ? "mt-2 inline-flex items-center justify-center rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
                              : "mt-2 inline-flex items-center justify-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700"
                          }
                        >
                          {result.alreadyConfirmed ? "Sudah dikonfirmasi sebelumnya" : "Kehadiran dikonfirmasi"}
                        </span>
                        <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(result.confirmedAt)}</p>
                      </div>
                    </>
                  )}

                  {!isPending && (
                    <Button onClick={handleScanAgain} className="mt-2 rounded-full px-6">
                      <Restart weight="BoldDuotone" className="h-4 w-4 mr-2" />
                      Scan Lagi
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {!showResultPanel && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowManualEntry((prev) => !prev)}
            className="inline-flex items-center gap-1.5 self-start text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Keyboard weight="BoldDuotone" className="h-4 w-4" />
            Tidak bisa scan? Masukkan kode manual
          </button>

          {showManualEntry && (
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-3">
              <Input
                value={manualCode}
                onChange={handleManualCodeChange}
                onKeyDown={handleManualKeyDown}
                placeholder="Masukkan kode tamu..."
                className="rounded-xl"
                autoFocus
              />
              <Button
                onClick={handleManualSubmit}
                disabled={!manualCode.trim()}
                className="shrink-0 rounded-xl"
              >
                Check-in
              </Button>
            </div>
          )}
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
