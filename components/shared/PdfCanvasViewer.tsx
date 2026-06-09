"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Refresh } from "@solar-icons/react";

// Worker must be configured in the same module as Document/Page per react-pdf docs.
// Self-hosted: file copied from node_modules/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs → public/
// If pdfjs-dist is upgraded, re-copy the worker: Copy-Item node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.mjs
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface PdfCanvasViewerProps {
  /** Blob URL (from URL.createObjectURL) pointing to the PDF. */
  blobUrl: string;
}

export function PdfCanvasViewer({ blobUrl }: PdfCanvasViewerProps): React.ReactElement {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleLoadSuccess = useCallback(({ numPages: n }: { numPages: number }): void => {
    setNumPages(n);
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-y-auto overflow-x-hidden"
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
              width={containerWidth > 0 ? containerWidth - 32 : undefined}
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
  );
}
