import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { deleteFromStorage } from "@/lib/storage";
import { revalidateTag } from "next/cache";

const bodySchema = z.object({ stepId: z.string().min(1) });

export async function POST(req: Request): Promise<Response> {
  // 1. Auth — session required before any DB work
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Validate body
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "stepId wajib diisi" }, { status: 400 });
  }
  const { stepId } = parsed.data;

  // 3. Fetch step to determine module (needed for authorization branch)
  const step = await db.approvalRecordStep.findUnique({
    where: { id: stepId },
    include: { record: true },
  });
  if (!step) return Response.json({ error: "Step tidak ditemukan" }, { status: 404 });

  // 4. Authorization — module-based guard
  if (step.record.module === "booking") {
    // booking module: allow if super-admin OR has booking:reset-approval permission
    const allowed =
      session.user.isSuperAdmin ||
      (await hasPermission(session.user.roleId, "booking", "reset-approval"));
    if (!allowed) {
      return Response.json({ error: "Tidak memiliki izin untuk reset step approval booking" }, { status: 403 });
    }
  } else {
    // All other modules (e.g. package): super-admin only
    const isAdmin = session.user.isSuperAdmin;
    if (!isAdmin) {
      return Response.json({ error: "Hanya super-admin yang bisa reset step" }, { status: 403 });
    }
  }

  // 5. Rate limit (after auth + authz, before DB write)
  if (!mutationLimiter.check(`reset-approval:${session.user.id}`)) {
    return rateLimitResponse();
  }

  // Referensi file PO manual (scan PO fisik) yg tersimpan di kolom JSON
  // clientAgreementUploaded. Cuma jalur upload manual yg punya file di S3 —
  // TTD digital disimpan inline di kolom `signature` (tidak ada file). Dibaca
  // SEBELUM transaksi; file-nya dihapus best-effort SETELAH transaksi sukses.
  const uploadedPath = (() => {
    const v = step.clientAgreementUploaded as { path?: unknown } | null;
    return v && typeof v.path === "string" ? v.path : null;
  })();

  // 6. Transaction — granular per-step reset only
  try {
    const transactionOps = [
      db.approvalRecordStep.update({
        where: { id: stepId },
        // clientAgreementUploaded di-null-in juga: reset step wajib menghapus
        // SEMUA artefak persetujuan (TTD digital via `signature`, PO manual via
        // JSON ini). Tanpa ini, referensi PO lama nyangkut di step.
        data: {
          status: "pending",
          decidedById: null,
          decidedAt: null,
          signature: null,
          clientAgreementUploaded: Prisma.DbNull,
        },
      }),
      db.approvalRecord.update({
        where: { id: step.recordId },
        data: { status: "pending" },
      }),
      // For booking module: always reset bookingStatus (approval is no longer complete)
      ...(step.record.module === "booking"
        ? [
            db.booking.update({
              where: { id: step.record.entityId },
              data: { bookingStatus: "Pending" },
            }),
            // Only reset clientAgreement when the client step itself is being reset
            ...(step.approverType === "client"
              ? [
                  db.clientAgreement.updateMany({
                    where: { bookingId: step.record.entityId },
                    data: { status: "Pending", signedAt: null, viewedAt: null },
                  }),
                ]
              : []),
          ]
        : []),
    ];

    await db.$transaction(transactionOps);

    // Hapus file PO manual dari S3 SETELAH DB commit. Best-effort: kegagalan
    // storage tidak boleh menggagalkan reset (DB sudah jadi sumber kebenaran &
    // referensi JSON-nya sudah dibersihkan di transaksi di atas).
    if (step.approverType === "client" && uploadedPath) {
      try {
        await deleteFromStorage(uploadedPath);
      } catch (e) {
        console.error("[reset-step] gagal hapus file PO manual dari storage", e);
      }
    }

    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const userAgent = req.headers.get("user-agent") ?? "unknown";

    await logAudit({
      userId: session.user.id,
      action: "booking.reset_approval",
      result: "success",
      entityType: "ApprovalRecordStep",
      entityId: stepId,
      description: `Step ${step.stepOrder} (${step.approverType}) di-reset`,
      changes: { stepId, stepOrder: step.stepOrder, approverType: step.approverType, module: step.record.module },
      ipAddress: ip,
      userAgent,
    });

    revalidateTag("approvals", "max");
    revalidateTag("bookings", "max");

    return Response.json({ success: true });
  } catch (e) {
    console.error("[reset-step]", e);
    return Response.json({ error: "Gagal reset step" }, { status: 500 });
  }
}
