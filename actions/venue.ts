"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";

const venueSchema = z.object({
  name: z.string().min(1, "Nama venue wajib diisi"),
  code: z.string().min(1, "Kode venue wajib diisi"),
  brandId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  capacity: z.coerce.number().int().positive().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
});

const updateVenueSchema = venueSchema.extend({ id: z.string().min(1) });

export async function createVenue(data: unknown) {
  const { error } = await requirePermission({ module: "settings", action: "create" });
  if (error) return { success: false, error };

  const parsed = venueSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const venue = await db.venue.create({ data: parsed.data });
    revalidateTag("venues", "max");
    return { success: true, venue };
  } catch {
    return { success: false, error: "Kode venue sudah digunakan." };
  }
}

export async function updateVenue(data: unknown) {
  const { error } = await requirePermission({ module: "settings", action: "edit" });
  if (error) return { success: false, error };

  const parsed = updateVenueSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { id, ...rest } = parsed.data;

  try {
    const venue = await db.venue.update({ where: { id }, data: rest });
    revalidateTag("venues", "max");
    return { success: true, venue };
  } catch {
    return { success: false, error: "Gagal memperbarui venue." };
  }
}

export async function deleteVenue(id: string) {
  const { error } = await requirePermission({ module: "settings", action: "delete" });
  if (error) return { success: false, error };

  try {
    await db.venue.update({ where: { id }, data: { isActive: false } });
    revalidateTag("venues", "max");
    return { success: true };
  } catch {
    return { success: false, error: "Gagal menghapus venue." };
  }
}
