"use client";

/**
 * Shared sub-components used by the Daily Activity drawers (create + edit).
 * Keep these pure/presentational — no server actions, no TanStack mutation here.
 */

import React from "react";
import { type IconProps } from "@solar-icons/react";

// ─── SectionHeader ─────────────────────────────────────────────────────────────

export function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ForwardRefExoticComponent<Omit<IconProps, "ref"> & React.RefAttributes<SVGSVGElement>>;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 pb-1 border-b border-border">
      <Icon weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </span>
    </div>
  );
}
