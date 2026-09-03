"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface LoginBannerSlide {
  id: string;
  title: string;
  imageUrl: string;
}

interface Props {
  banners: LoginBannerSlide[];
}

const AUTOPLAY_INTERVAL_MS = 6000;

/** Full-height banner carousel for the login panel's right column.
 *  One image → static; many → slow-zoom crossfade with story-style
 *  segmented progress bars that fill along with the autoplay timer. */
export function LoginBannerCarousel({ banners }: Props): React.ReactElement | null {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const fillRef = useRef<HTMLSpanElement | null>(null);

  const total = banners.length;

  useEffect(() => {
    if (total <= 1) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const fill = fillRef.current;
    if (fill) fill.style.width = "0%";
    if (paused) return;

    let raf = 0;
    let start: number | null = null;

    function frame(now: number) {
      if (start === null) start = now;
      const ratio = Math.min((now - start) / AUTOPLAY_INTERVAL_MS, 1);
      if (fill) fill.style.width = `${ratio * 100}%`;
      if (ratio >= 1) {
        setIndex((i) => (i + 1) % total);
        return;
      }
      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [index, paused, total]);

  if (total === 0) return null;

  return (
    <div
      className={cn("absolute", "inset-0", "overflow-hidden")}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {banners.map((banner, i) => (
        <div
          key={banner.id}
          className={cn(
            "absolute", "inset-0", "overflow-hidden", "transition-opacity", "duration-700", "motion-reduce:transition-none",
            i === index ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
        >
          <Image
            src={banner.imageUrl}
            alt={banner.title}
            fill
            priority={i === 0}
            sizes="(max-width: 768px) 0px, 50vw"
            className={cn(
              "object-cover", "ease-out", "will-change-transform",
              "transition-transform", "duration-[7000ms]",
              "dark:brightness-[0.2]", "dark:grayscale",
              "motion-reduce:transition-none", "motion-reduce:scale-100",
              i === index && total > 1 ? "scale-105" : "scale-100",
            )}
          />
        </div>
      ))}

      {/* Scrim: keeps the progress bars legible over any photo + adds depth */}
      <div className={cn("absolute", "inset-x-0", "bottom-0", "h-28", "bg-gradient-to-t", "from-black/45", "via-black/10", "to-transparent", "pointer-events-none")} />

      {total > 1 && (
        <div className={cn("absolute", "inset-x-0", "bottom-0", "z-10", "flex", "items-end", "gap-1.5", "p-4")}>
          {banners.map((banner, i) => (
            <button
              key={banner.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Ke banner ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
              className={cn("group", "relative", "h-3", "flex-1", "cursor-pointer")}
            >
              <span className={cn("absolute", "inset-x-0", "bottom-0", "h-1", "overflow-hidden", "bg-card/30", "transition-colors", "group-hover:bg-card/50")}>
                <span
                  ref={i === index ? fillRef : undefined}
                  className={cn("block", "h-full", "bg-card")}
                  style={{ width: i < index ? "100%" : "0%" }}
                />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
