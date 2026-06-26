import { z } from "zod";

export const createWorkLocationSchema = z.object({
  name: z.string().min(1, "Nama lokasi wajib diisi"),
  address: z.string().optional(),
  venueId: z.string().optional(),
  latitude: z.number().min(-90, "Latitude minimal -90").max(90, "Latitude maksimal 90. Pastikan tidak tertukar dengan longitude."),
  longitude: z.number().min(-180, "Longitude minimal -180").max(180, "Longitude maksimal 180"),
  radiusMeters: z.number().int().min(10).max(5000).default(100),
});

export const updateWorkLocationSchema = createWorkLocationSchema.partial();

export type CreateWorkLocationInput = z.infer<typeof createWorkLocationSchema>;
export type UpdateWorkLocationInput = z.infer<typeof updateWorkLocationSchema>;
