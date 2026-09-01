"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { AltArrowLeft, AltArrowRight } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BannerSlide {
  src: string;
  alt: string;
}

// Tambah banner baru di sini (taruh file webp-nya di public/) — carousel otomatis
// nyesuain jumlah slide, dot indicator, dan tombol prev/next.
const BANNERS: BannerSlide[] = [
  { src: "/sales-champion-banner-v3.webp", alt: "Sales Champion — Top 3 Pemenang Sales" },
];

const AUTOPLAY_INTERVAL_MS = 6000;

export function DashboardBannerCarousel(): React.ReactElement | null {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const goTo = useCallback((i: number) => {
    setIndex((i + BANNERS.length) % BANNERS.length);
  }, []);

  const handlePrev = useCallback(() => goTo(index - 1), [goTo, index]);
  const handleNext = useCallback(() => goTo(index + 1), [goTo, index]);

  useEffect(() => {
    if (BANNERS.length <= 1 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % BANNERS.length);
    }, AUTOPLAY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [paused]);

  if (BANNERS.length === 0) return null;

  return (
    <div
      className={cn("relative", "w-full", "overflow-hidden", "rounded-2xl", "border", "border-border", "shadow-sm")}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className={cn("relative", "aspect-[3/1]", "w-full")}>
        {BANNERS.map((banner, i) => (
          <Image
            key={banner.src}
            src={banner.src}
            alt={banner.alt}
            fill
            priority={i === 0}
            className={cn(
              "object-cover", "transition-opacity", "duration-500", "motion-reduce:transition-none",
              i === index ? "opacity-100" : "opacity-0",
            )}
          />
        ))}
      </div>

      {BANNERS.length > 1 && (
        <>
          <Button
            variant="outline"
            size="icon"
            className={cn("absolute", "left-3", "top-1/2", "-translate-y-1/2", "h-8", "w-8", "rounded-full", "bg-card/80", "backdrop-blur-sm")}
            onClick={handlePrev}
            aria-label="Banner sebelumnya"
          >
            <AltArrowLeft weight="BoldDuotone" className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className={cn("absolute", "right-3", "top-1/2", "-translate-y-1/2", "h-8", "w-8", "rounded-full", "bg-card/80", "backdrop-blur-sm")}
            onClick={handleNext}
            aria-label="Banner berikutnya"
          >
            <AltArrowRight weight="BoldDuotone" className="h-4 w-4" />
          </Button>

          <div className={cn("absolute", "bottom-1.5", "left-1/2", "-translate-x-1/2", "flex", "items-center")}>
            {BANNERS.map((banner, i) => (
              <button
                key={banner.src}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Ke banner ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
                className={cn("flex", "items-center", "justify-center", "p-2")}
              >
                <span
                  className={cn(
                    "h-1.5", "rounded-full", "transition-all",
                    i === index ? "w-6 bg-primary" : "w-1.5 bg-card/70",
                  )}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
