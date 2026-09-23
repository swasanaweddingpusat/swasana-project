import type { GuestVisitStatus } from "@prisma/client";

/**
 * Single source of truth untuk label tampilan `GuestVisitStatus`.
 * Dipakai oleh badge status (GuestbookClient), opsi filter Select
 * (GuestbookFilterDrawer), dan kolom Excel export (app/api/guestbook/export/route.ts)
 * — jangan hardcode label enum ini di tempat lain.
 */
export const GUEST_VISIT_STATUS_LABELS: Record<GuestVisitStatus, string> = {
  cold: "Cold",
  warm: "Warm",
  hot: "Hot",
  done_visit: "Done Visit",
  to_be_discuss: "To Be Discuss",
  deal: "Deal",
  lost: "Lost",
};

export const GUEST_VISIT_STATUS_VALUES = Object.keys(
  GUEST_VISIT_STATUS_LABELS
) as GuestVisitStatus[];
