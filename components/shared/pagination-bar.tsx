"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "@solar-icons/react";
import { cn } from "@/lib/utils";

interface PaginationBarProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Accessible label for the nav landmark, e.g. "Navigasi halaman brand". */
  label?: string;
  className?: string;
}

/** Returns a page range array with "..." for gaps.
 *  Always shows: first, last, current, and 1 neighbour each side.
 *  Example (current=50, total=150): [1, "...", 49, 50, 51, "...", 150]
 */
function buildPageRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = new Set<number>();
  pages.add(1);
  pages.add(total);
  pages.add(current);
  if (current - 1 >= 1) pages.add(current - 1);
  if (current + 1 <= total) pages.add(current + 1);

  const sorted = Array.from(pages).sort((a, b) => a - b);
  const result: (number | "...")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    result.push(sorted[i]);
    if (i < sorted.length - 1 && sorted[i + 1] - sorted[i] > 1) {
      result.push("...");
    }
  }
  return result;
}

/**
 * Shared numbered pagination used across list/table views. Desktop shows
 * numbered page buttons with ellipsis gaps (Prev · 1 … 4 5 6 … 20 · Next);
 * mobile collapses to "page X / Y". Mirrors the booking table pagination so
 * every table looks identical even with many pages.
 */
export function PaginationBar({
  currentPage,
  totalPages,
  onPageChange,
  label = "Navigasi halaman",
  className,
}: PaginationBarProps) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "flex flex-col gap-3 px-4 sm:px-6 py-4 border-t sm:flex-row sm:justify-between sm:items-center",
        className
      )}
    >
      <Button
        variant="outline"
        onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
        disabled={currentPage === 1}
        aria-label="Halaman sebelumnya"
      >
        <ArrowLeft weight="BoldDuotone" aria-hidden="true" className="w-4 h-4" /> Previous
      </Button>

      {/* Mobile: page X / Y */}
      <span className="text-sm text-muted-foreground text-center sm:hidden">
        {currentPage} / {totalPages}
      </span>

      {/* Desktop: numbered pages with ellipsis gaps */}
      <div className="hidden sm:flex items-center gap-1 overflow-x-auto justify-center">
        {buildPageRange(currentPage, totalPages).map((page, idx) => {
          if (page === "...") {
            return (
              <span
                key={`ellipsis-${idx}`}
                aria-hidden="true"
                className="px-2 py-1 text-sm text-muted-foreground shrink-0 select-none"
              >
                …
              </span>
            );
          }
          const isCurrent = currentPage === page;
          return (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              aria-label={`Halaman ${page}`}
              aria-current={isCurrent ? "page" : undefined}
              className={cn(
                "px-3 py-1 rounded-md text-sm font-medium shrink-0",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isCurrent
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              )}
            >
              {page}
            </button>
          );
        })}
      </div>

      <Button
        variant="outline"
        onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
        disabled={currentPage === totalPages}
        aria-label="Halaman berikutnya"
      >
        Next <ArrowRight weight="BoldDuotone" aria-hidden="true" className="w-4 h-4" />
      </Button>
    </nav>
  );
}
