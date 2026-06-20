"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Restart, CheckCircle } from "@solar-icons/react";

interface CameraModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (photoBase64: string) => void;
}

export function CameraModal({ open, onClose, onCapture }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch {
      setCameraError("Tidak dapat mengakses kamera. Pastikan izin kamera sudah diberikan.");
    }
  }, []);

  useEffect(() => {
    if (open) {
      setPreview(null);
      setCameraError(null);
      const timer = setTimeout(() => startCamera(), 300);
      return () => clearTimeout(timer);
    } else {
      stopCamera();
    }
    return undefined;
  }, [open, startCamera, stopCamera]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setPreview(dataUrl);
    stopCamera();
  }, [stopCamera]);

  const handleRetake = useCallback(() => {
    setPreview(null);
    startCamera();
  }, [startCamera]);

  const handleConfirm = useCallback(() => {
    if (preview) {
      onCapture(preview);
      setPreview(null);
    }
  }, [preview, onCapture]);

  const handleClose = useCallback(() => {
    stopCamera();
    setPreview(null);
    onClose();
  }, [stopCamera, onClose]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera weight="BoldDuotone" className="h-5 w-5" />
            Ambil Selfie
          </DialogTitle>
        </DialogHeader>

        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
          {!preview && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
          )}
          {preview && (
            <img src={preview} alt="Preview selfie" className="h-full w-full object-cover" />
          )}
          {!cameraReady && !preview && !cameraError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Memuat kamera...</p>
            </div>
          )}
          {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <p className="text-sm text-destructive text-center">{cameraError}</p>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <DialogFooter className="flex-row gap-2 sm:justify-center">
          {!preview && (
            <Button
              onClick={handleCapture}
              disabled={!cameraReady}
              className="rounded-full px-6"
            >
              <Camera weight="BoldDuotone" className="h-4 w-4 mr-2" />
              Ambil Foto
            </Button>
          )}
          {preview && (
            <>
              <Button variant="outline" onClick={handleRetake} className="rounded-full px-6">
                <Restart weight="BoldDuotone" className="h-4 w-4 mr-2" />
                Ulangi
              </Button>
              <Button onClick={handleConfirm} className="rounded-full px-6">
                <CheckCircle weight="BoldDuotone" className="h-4 w-4 mr-2" />
                Gunakan Foto
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
