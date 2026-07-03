"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Plain, Play, Stop, TrashBinTrash } from "@solar-icons/react";
import { cn } from "@/lib/utils";

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_DURATION_S = 300; // 5 minutes
const PEAK_COUNT = 40;
const SAMPLE_INTERVAL_MS = 100;
const LIVE_PEAK_WINDOW = 40; // bars shown in live waveform

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function pickMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ] as const;
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return "";
}

function downsamplePeaks(raw: number[]): number[] {
  if (raw.length === 0) return Array<number>(PEAK_COUNT).fill(0.1);

  if (raw.length <= PEAK_COUNT) {
    const padded = [...raw];
    while (padded.length < PEAK_COUNT) padded.push(0.05);
    return padded;
  }

  return Array.from({ length: PEAK_COUNT }, (_, i) => {
    const start = Math.floor((i / PEAK_COUNT) * raw.length);
    const end = Math.floor(((i + 1) / PEAK_COUNT) * raw.length);
    const slice = raw.slice(start, Math.max(end, start + 1));
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

type RecorderState = "requesting" | "error" | "recording" | "paused" | "preview";

interface Props {
  onSend: (data: { blob: Blob; duration: number; peaks: number[] }) => void;
  onCancel: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function VoiceRecorder({ onSend, onCancel }: Props) {
  const [recState, setRecState] = useState<RecorderState>("requesting");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [elapsed, setElapsed] = useState(0);
  const [livePeaks, setLivePeaks] = useState<number[]>([]);
  const [previewPeaks, setPreviewPeaks] = useState<number[]>([]);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  // Refs — no state so closures always see current values
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const peakSamplesRef = useRef<number[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastSampleRef = useRef<number>(0);
  const mimeTypeRef = useRef<string>("");
  const blobRef = useRef<Blob | null>(null);
  const objectUrlRef = useRef<string>("");
  const elapsedRef = useRef(0);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // ── Cleanup primitives ────────────────────────────────────────────────────

  const stopSampling = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
      analyserRef.current = null;
    }
  }, []);

  const revokePreviewUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = "";
    }
  }, []);

  // ── RAF sampling loop ─────────────────────────────────────────────────────

  const startSampling = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const bufLen = analyser.frequencyBinCount;
    const dataArr = new Uint8Array(bufLen);

    const tick = (now: number) => {
      if (now - lastSampleRef.current >= SAMPLE_INTERVAL_MS) {
        lastSampleRef.current = now;
        analyser.getByteFrequencyData(dataArr);

        let sum = 0;
        for (let i = 0; i < bufLen; i++) sum += dataArr[i];
        const avg = sum / bufLen / 255;

        peakSamplesRef.current.push(avg);
        setLivePeaks((prev) => {
          const next = [...prev, avg];
          return next.length > LIVE_PEAK_WINDOW ? next.slice(-LIVE_PEAK_WINDOW) : next;
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // ── Stop recording → enter preview ────────────────────────────────────────

  const stopRecording = useCallback(() => {
    stopSampling();
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    recorder.onstop = () => {
      const mime = mimeTypeRef.current || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: mime });
      blobRef.current = blob;
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      const peaks = downsamplePeaks(peakSamplesRef.current);
      setPreviewPeaks(peaks);
      setRecState("preview");
    };

    recorder.stop();
    releaseStream();
  }, [stopSampling, releaseStream]);

  // ── Init: request mic & start recording ──────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices || typeof MediaRecorder === "undefined") {
        setErrorMsg("Browser Anda tidak mendukung perekaman audio.");
        setRecState("error");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        // Web Audio setup for waveform
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;

        // MediaRecorder setup
        const mime = pickMimeType();
        mimeTypeRef.current = mime;
        const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
        recorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.start(250);
        setRecState("recording");

        // Duration timer
        elapsedRef.current = 0;
        timerRef.current = setInterval(() => {
          elapsedRef.current += 1;
          setElapsed(elapsedRef.current);
          if (elapsedRef.current >= MAX_DURATION_S) {
            stopRecording();
          }
        }, 1000);

        startSampling();
      } catch {
        if (!cancelled) {
          setErrorMsg("Akses mikrofon ditolak atau tidak tersedia.");
          setRecState("error");
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
      stopSampling();
      releaseStream();
      revokePreviewUrl();
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") rec.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Controls ──────────────────────────────────────────────────────────────

  const handlePauseResume = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder) return;

    if (recorder.state === "recording") {
      recorder.pause();
      stopSampling();
      setRecState("paused");
    } else if (recorder.state === "paused") {
      recorder.resume();
      timerRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
        if (elapsedRef.current >= MAX_DURATION_S) {
          stopRecording();
        }
      }, 1000);
      startSampling();
      setRecState("recording");
    }
  }, [stopSampling, startSampling, stopRecording]);

  const handleCancel = useCallback(() => {
    stopSampling();
    releaseStream();
    revokePreviewUrl();
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    onCancel();
  }, [stopSampling, releaseStream, revokePreviewUrl, onCancel]);

  const handleSend = useCallback(() => {
    const blob = blobRef.current;
    if (!blob) return;
    revokePreviewUrl();
    onSend({ blob, duration: elapsedRef.current, peaks: previewPeaks });
  }, [revokePreviewUrl, onSend, previewPeaks]);

  // ── Preview playback ──────────────────────────────────────────────────────

  const handlePreviewPlay = useCallback(() => {
    const audio = previewAudioRef.current;
    if (!audio) return;
    if (isPreviewPlaying) {
      audio.pause();
      setIsPreviewPlaying(false);
    } else {
      audio.play().catch(() => {});
      setIsPreviewPlaying(true);
    }
  }, [isPreviewPlaying]);

  // ── Render: error ─────────────────────────────────────────────────────────

  if (recState === "error") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 rounded-xl">
        <p className="flex-1 text-sm text-destructive">{errorMsg}</p>
        <button
          type="button"
          onClick={handleCancel}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Batal
        </button>
      </div>
    );
  }

  // ── Render: preview ───────────────────────────────────────────────────────

  if (recState === "preview") {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 bg-card rounded-xl border border-border min-h-12">
        {/* Hidden audio for preview playback */}
        <audio
          ref={previewAudioRef}
          src={objectUrlRef.current}
          onEnded={() => setIsPreviewPlaying(false)}
          preload="metadata"
        />

        {/* Cancel */}
        <button
          type="button"
          onClick={handleCancel}
          className="shrink-0 h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          aria-label="Hapus rekaman"
        >
          <TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />
        </button>

        {/* Play / pause preview */}
        <button
          type="button"
          onClick={handlePreviewPlay}
          className="shrink-0 h-8 w-8 flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          aria-label={isPreviewPlaying ? "Jeda preview" : "Putar preview"}
        >
          {isPreviewPlaying
            ? <Pause weight="BoldDuotone" className="h-4 w-4" />
            : <Play weight="BoldDuotone" className="h-4 w-4" />
          }
        </button>

        {/* Static waveform from captured peaks */}
        <div className="flex-1 flex items-center gap-px h-8 overflow-hidden" aria-hidden>
          {previewPeaks.map((peak, i) => (
            <div
              key={i}
              className="flex-1 rounded-full bg-primary/40 min-h-px"
              style={{ height: `${Math.max(3, peak * 28)}px` }}
            />
          ))}
        </div>

        {/* Duration */}
        <span className="shrink-0 text-xs text-muted-foreground font-mono tabular-nums min-w-9 text-right">
          {formatTime(elapsedRef.current)}
        </span>

        {/* Send */}
        <button
          type="button"
          onClick={handleSend}
          className="shrink-0 h-8 w-8 flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          aria-label="Kirim voice note"
        >
          <Plain weight="BoldDuotone" className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // ── Render: recording / paused / requesting ───────────────────────────────

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 bg-card rounded-xl border border-border min-h-12">
      {/* Cancel */}
      <button
        type="button"
        onClick={handleCancel}
        className="shrink-0 h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        aria-label="Batal rekam"
      >
        <TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />
      </button>

      {/* Recording dot + timer */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span
          className={cn(
            "h-2 w-2 rounded-full bg-destructive",
            recState === "recording" && "animate-pulse",
          )}
          aria-hidden
        />
        <span className="text-xs font-mono tabular-nums text-foreground min-w-9">
          {formatTime(elapsed)}
        </span>
      </div>

      {/* Live waveform */}
      <div className="flex-1 flex items-center gap-px h-8 overflow-hidden" aria-hidden>
        {recState === "requesting" ? (
          <p className="text-xs text-muted-foreground">Meminta akses mikrofon…</p>
        ) : (
          livePeaks.map((peak, i) => (
            <div
              key={i}
              className="flex-1 rounded-full bg-primary/50 min-h-px"
              style={{ height: `${Math.max(2, peak * 28)}px` }}
            />
          ))
        )}
      </div>

      {/* Pause / Resume */}
      <button
        type="button"
        onClick={handlePauseResume}
        disabled={recState === "requesting"}
        className="shrink-0 h-8 w-8 flex items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50"
        aria-label={recState === "paused" ? "Lanjut rekam" : "Jeda rekam"}
      >
        {recState === "paused"
          ? <Play weight="BoldDuotone" className="h-4 w-4" />
          : <Pause weight="BoldDuotone" className="h-4 w-4" />
        }
      </button>

      {/* Stop → go to preview */}
      <button
        type="button"
        onClick={stopRecording}
        disabled={recState === "requesting"}
        className="shrink-0 h-8 w-8 flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        aria-label="Selesai rekam"
      >
        <Stop weight="BoldDuotone" className="h-4 w-4" />
      </button>
    </div>
  );
}
