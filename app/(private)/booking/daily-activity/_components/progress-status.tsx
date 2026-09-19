import { cn } from "@/lib/utils";
import type { ProgressStatus } from "@/lib/validations/daily-activity";

// ─── Progress status labels + badge tokens (Daily Activity) ───────────────────
//
// Token-only colors (design system: no hardcoded hex/brand colors here).

export const PROGRESS_STATUS_LABELS: Record<ProgressStatus, string> = {
  COLD: "Cold",
  WARM: "Warm",
  HOT: "Hot",
  FREEZE: "Freeze",
  DEAL: "Deal",
  LOST: "Lost",
};

export const PROGRESS_STATUS_BADGE_CLASS: Record<ProgressStatus, string> = {
  COLD: "bg-secondary text-secondary-foreground",
  WARM: "bg-accent text-accent-foreground",
  HOT: "bg-primary/10 text-primary",
  FREEZE: "bg-muted text-muted-foreground",
  DEAL: "bg-primary text-primary-foreground",
  LOST: "bg-destructive/10 text-destructive",
};

interface ProgressStatusBadgeProps {
  status: ProgressStatus;
  className?: string;
}

export function ProgressStatusBadge({
  status,
  className,
}: ProgressStatusBadgeProps): React.ReactElement {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        PROGRESS_STATUS_BADGE_CLASS[status],
        className
      )}
    >
      {PROGRESS_STATUS_LABELS[status]}
    </span>
  );
}
