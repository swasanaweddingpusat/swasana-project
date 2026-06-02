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

/**
 * Shared numbered pagination used across list/table views. Desktop shows
 * numbered page buttons (Prev · 1 2 3 · Next); mobile collapses to "page X / Y".
 * Mirrors the original inline leads pagination so every table looks identical.
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

      {/* Desktop: numbered pages */}
      <div className="hidden sm:flex items-center gap-1 overflow-x-auto justify-center">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
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
