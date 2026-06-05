import { requirePermissionForRoute } from "@/lib/permissions";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { revalidateTag } from "next/cache";
import { uploadToR2, deleteFromR2, extractKeyFromUrl } from "@/lib/r2";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// ─── POST /api/maintenance/upload ─────────────────────────────────────────────

export async function POST(req: Request) {
  const { session, response } = await requirePermissionForRoute({
    module: "maintenance",
    action: "create",
  });
  if (response) return response;
  if (!mutationLimiter.check(`maintenance-upload:${session.user.id}`)) return rateLimitResponse();

  try {
    const formData = await req.formData();
    const ticketId = formData.get("ticketId");
    const file = formData.get("file");

    if (typeof ticketId !== "string" || !ticketId) {
      return Response.json({ error: "ticketId wajib diisi." }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return Response.json({ error: "File wajib disertakan." }, { status: 400 });
    }

    // Validate file type
    if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) {
      return Response.json({ error: "Tipe file tidak didukung. Gunakan JPEG, PNG, WebP, atau GIF." }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_SIZE_BYTES) {
      return Response.json({ error: "Ukuran file maksimal 5MB." }, { status: 400 });
    }

    // Check ticket exists
    const ticket = await db.maintenanceTicket.findUnique({
      where: { id: ticketId },
      select: { id: true },
    });
    if (!ticket) {
      return Response.json({ error: "Tiket tidak ditemukan." }, { status: 404 });
    }

    // Generate unique key and upload to R2
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    const randomId = Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map((b) => chars[b % chars.length])
      .join("");
    const ext = file.name.split(".").pop() ?? "jpg";
    const key = `maintenance/${ticketId}/${randomId}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadToR2(buffer, key, file.type);

    const [image] = await db.$transaction([
      db.maintenanceImage.create({
        data: {
          ticketId,
          url,
          fileName: file.name,
        },
        select: { id: true, url: true, fileName: true },
      }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "maintenance.image_uploaded",
      result: "success",
      entityType: "MaintenanceImage",
      entityId: image.id,
    });

    revalidateTag("maintenance", "max");

    return Response.json(image, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal mengunggah gambar." }, { status: 500 });
  }
}

// ─── DELETE /api/maintenance/upload?imageId=xxx ──────────────────────────────

export async function DELETE(req: Request) {
  const { session, response } = await requirePermissionForRoute({
    module: "maintenance",
    action: "delete",
  });
  if (response) return response;
  if (!mutationLimiter.check(`maintenance-del-img:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const imageId = searchParams.get("imageId");

  if (!imageId) {
    return Response.json({ error: "imageId wajib diisi." }, { status: 400 });
  }

  const image = await db.maintenanceImage.findUnique({
    where: { id: imageId },
    select: { id: true, url: true },
  });
  if (!image) {
    return Response.json({ error: "Gambar tidak ditemukan." }, { status: 404 });
  }

  try {
    const r2Key = extractKeyFromUrl(image.url);
    await deleteFromR2(r2Key);
  } catch {
    // R2 deletion is best-effort
  }

  await db.$transaction([
    db.maintenanceImage.delete({ where: { id: imageId } }),
  ]);

  await logAudit({
    userId: session.user.id,
    action: "maintenance.image_deleted",
    result: "success",
    entityType: "MaintenanceImage",
    entityId: imageId,
  });

  revalidateTag("maintenance", "max");

  return Response.json({ success: true });
}
