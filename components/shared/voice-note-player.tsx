"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play } from "@solar-icons/react";
import { cn } from "@/lib/utils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const FALLBACK_PEAKS = Array<number>(40).fill(0.3);

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  url: string;
  duration: number;
  peaks: number[];
  isSelf: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function VoiceNotePlayer({ url, duration, peaks: rawPeaks, isSelf }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveRef = useRef<HTMLDivElement | null>(null);

  const peaks = rawPeaks.length > 0 ? rawPeaks : FALLBACK_PEAKS;

  // ── Playback controls ─────────────────────────────────────────────────────

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  }, [isPlaying]);

  // ── Waveform click → seek ─────────────────────────────────────────────────

  const handleWaveClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const waveEl = waveRef.current;
    if (!audio || !waveEl) return;

    const rect = waveEl.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const dur = audio.duration || duration;
    audio.currentTime = ratio * dur;
    setProgress(ratio);
    setCurrentTime(ratio * dur);
  }, [duration]);

  // ── Audio event handlers ──────────────────────────────────────────────────

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };
    const onTimeUpdate = () => {
      const dur = audio.duration || duration;
      if (dur > 0) {
        setProgress(audio.currentTime / dur);
        setCurrentTime(audio.currentTime);
      }
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("timeupdate", onTimeUpdate);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [duration]);

  // ── Active bar threshold ──────────────────────────────────────────────────

  const activeThreshold = Math.floor(progress * peaks.length);

  // ── Color tokens per bubble variant ──────────────────────────────────────
  // isSelf: inside a primary-colored bubble → use primary-foreground for elements
  // !isSelf: inside a secondary/card bubble → use foreground

  const playBtnClass = isSelf
    ? "bg-primary-foreground text-primary hover:bg-primary-foreground/90"
    : "bg-primary text-primary-foreground hover:bg-primary/90";

  const activeBarStyle = isSelf
    ? { background: "var(--brand-cream)" }
    : { background: "var(--brand-gold)" };

  const inactiveBarClass = isSelf
    ? "bg-primary-foreground/30"
    : "bg-muted-foreground/30";

  const timeClass = isSelf
    ? "text-primary-foreground/70"
    : "text-muted-foreground";

  return (
    <div className={cn("flex items-center gap-2 px-2 py-1.5 min-w-52 max-w-64")}>
      {/* Hidden audio element */}
      <audio ref={audioRef} src={url} preload="metadata" />

      {/* Play / Pause */}
      <button
        type="button"
        onClick={togglePlay}
        className={cn(
          "shrink-0 h-8 w-8 flex items-center justify-center rounded-full transition-colors",
          playBtnClass,
        )}
        aria-label={isPlaying ? "Jeda" : "Putar"}
      >
        {isPlaying
          ? <Pause weight="BoldDuotone" className="h-4 w-4" />
          : <Play weight="BoldDuotone" className="h-4 w-4" />
        }
      </button>

      {/* Waveform bars */}
      <div
        ref={waveRef}
        className="flex-1 flex items-center gap-px h-8 cursor-pointer overflow-hidden"
        onClick={handleWaveClick}
        role="slider"
        aria-label="Posisi audio"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {peaks.map((peak, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-full min-h-px transition-colors",
              i < activeThreshold ? "" : inactiveBarClass,
            )}
            style={{
              height: `${Math.max(2, peak * 28)}px`,
              ...(i < activeThreshold ? activeBarStyle : {}),
            }}
          />
        ))}
      </div>

      {/* Duration / current time */}
      <span className={cn("shrink-0 text-xs font-mono tabular-nums min-w-9 text-right", timeClass)}>
        {isPlaying ? formatTime(currentTime) : formatTime(duration)}
      </span>
    </div>
  );
}
