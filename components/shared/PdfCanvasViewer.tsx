"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Refresh, MagnifierZoomIn, MagnifierZoomOut } from "@solar-icons/react";

// Worker must be configured in the same module as Document/Page per react-pdf docs.
// Self-hosted: file copied from node_modules/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs → public/
// If pdfjs-dist is upgraded, re-copy the worker: Copy-Item node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.mjs
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.0;
const ZOOM_DEFAULT = 1.0;

/** Euclidean distance between two Touch points. */
function getTouchDistance(a: Touch, b: Touch): number {
  return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
}

interface PdfCanvasViewerProps {
  /** Blob URL (from URL.createObjectURL) pointing to the PDF. */
  blobUrl: string;
  /**
   * Show zoom in/out controls as a sticky toolbar above the PDF pages.
   * Defaults to false — existing consumers (PO preview modals) are unaffected.
   */
  showZoomControls?: boolean;
}

export function PdfCanvasViewer({ blobUrl, showZoomControls = false }: PdfCanvasViewerProps): React.ReactElement {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [scale, setScale] = useState<number>(ZOOM_DEFAULT);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pinch-to-zoom: mutable refs so we don't trigger re-renders during gesture.
  // pinchActive tracks whether a 2-finger gesture is currently in progress.
  const pinchActive = useRef<boolean>(false);
  // Distance between the two fingers at the moment the pinch started.
  const pinchStartDistance = useRef<number>(0);
  // Scale value at the moment the pinch started — ratio is applied on top of this.
  const pinchStartScale = useRef<number>(ZOOM_DEFAULT);
  // Mirror of the scale state kept in a ref so touch handlers (attached once) can
  // always read the latest scale without needing to re-attach their event listeners.
  const scaleRef = useRef<number>(ZOOM_DEFAULT);

  // Keep scaleRef in sync with scale state so pinch handlers always see the latest value.
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  // Track container width for responsive page sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(el);
    // Set initial width immediately
    setContainerWidth(el.clientWidth);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Pinch-to-zoom gesture — attached via native addEventListener with { passive: false }
  // so we can call preventDefault() on touchmove when 2 fingers are detected.
  // React's synthetic onTouchMove is passive in many browsers, making preventDefault() a no-op there.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function handleTouchStart(e: TouchEvent): void {
      if (e.touches.length === 2) {
        pinchActive.current = true;
        pinchStartDistance.current = getTouchDistance(e.touches[0], e.touches[1]);
        // Read from scaleRef (always current) — not from the stale closure captured at effect mount.
        pinchStartScale.current = scaleRef.current;
      } else {
        pinchActive.current = false;
      }
    }

    function handleTouchMove(e: TouchEvent): void {
      if (!pinchActive.current || e.touches.length !== 2) return;
      // Block native scroll & browser pinch-zoom only when a 2-finger gesture is active.
      e.preventDefault();
      const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
      if (pinchStartDistance.current === 0) return;
      const ratio = currentDistance / pinchStartDistance.current;
      const newScale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, pinchStartScale.current * ratio));
      setScale(parseFloat(newScale.toFixed(3)));
    }

    function handleTouchEnd(e: TouchEvent): void {
      // If fewer than 2 fingers remain, pinch gesture is over.
      if (e.touches.length < 2) {
        pinchActive.current = false;
      }
    }

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    // passive: false is required here so preventDefault() actually works.
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
    // No state dependencies — handlers read latest scale via scaleRef (a mutable ref),
    // so the effect only needs to run once on mount.
  }, []);

  const handleLoadSuccess = useCallback(({ numPages: n }: { numPages: number }): void => {
    setNumPages(n);
  }, []);

  function handleZoomIn(): void {
    setScale((prev) => Math.min(ZOOM_MAX, parseFloat((prev + ZOOM_STEP).toFixed(2))));
  }

  function handleZoomOut(): void {
    setScale((prev) => Math.max(ZOOM_MIN, parseFloat((prev - ZOOM_STEP).toFixed(2))));
  }

  // Base page width derived from container; scale multiplied on top
  const basePageWidth = containerWidth > 0 ? containerWidth - 32 : undefined;
  const scaledPageWidth = basePageWidth !== undefined ? Math.round(basePageWidth * scale) : undefined;

  // When scale > 1, pages may overflow width → allow horizontal scroll
  const overflowXClass = scale > 1 ? "overflow-x-auto" : "overflow-x-hidden";

  return (
    <div className="flex h-full w-full flex-col">
      {showZoomControls && (
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-center gap-2 border-b bg-background px-4 py-2">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= ZOOM_MIN}
            aria-label="Zoom out"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-muted transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            <MagnifierZoomOut weight="BoldDuotone" className="h-4 w-4 text-foreground" />
          </button>
          <span className="min-w-12 text-center font-mono text-xs text-muted-foreground">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= ZOOM_MAX}
            aria-label="Zoom in"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-muted transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            <MagnifierZoomIn weight="BoldDuotone" className="h-4 w-4 text-foreground" />
          </button>
        </div>
      )}
      <div
        ref={containerRef}
        className={`min-h-0 flex-1 overflow-y-auto ${overflowXClass}`}
      >
        <Document
          file={blobUrl}
          onLoadSuccess={handleLoadSuccess}
          loading={
            <div className="flex h-64 items-center justify-center">
              <Refresh weight="BoldDuotone" className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          }
          error={
            <div className="flex h-64 items-center justify-center p-4">
              <div className="rounded-xl border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
                Gagal memuat halaman PDF
              </div>
            </div>
          }
          className="flex flex-col items-center gap-4 pb-6 pt-4"
        >
          {numPages !== null &&
            Array.from({ length: numPages }, (_, i) => (
              <Page
                key={`page_${i + 1}`}
                pageNumber={i + 1}
                width={scaledPageWidth}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                className="shadow-md"
                loading={
                  <div className="flex h-40 items-center justify-center">
                    <Refresh weight="BoldDuotone" className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                }
              />
            ))}
        </Document>
      </div>
    </div>
  );
}
