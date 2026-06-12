import { z } from "zod";

/**
 * Input untuk saveEditDraft. formState sengaja dibiarkan sebagai record bebas
 * (snapshot full state step 2-5 dari drawer) — divalidasi bentuk dasarnya saja,
 * bukan tiap field, karena ini buffer UI bukan data otoritatif. Otorisasi &
 * integritas tetap dijaga saat commit lewat editBooking.
 */
export const saveEditDraftSchema = z.object({
  bookingId: z.string().min(1),
  formState: z.record(z.string(), z.unknown()),
  pendingUploads: z.array(z.string()).default([]),
});

export type SaveEditDraftInput = z.infer<typeof saveEditDraftSchema>;

export const discardEditDraftSchema = z.object({
  bookingId: z.string().min(1),
});
