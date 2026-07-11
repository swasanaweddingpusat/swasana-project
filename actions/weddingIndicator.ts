"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter } from "@/lib/rate-limit";
import {
  createWeddingIndicatorSchema,
  updateWeddingIndicatorSchema,
} from "@/lib/validations/weddingIndicator";
import { z } from "zod";

function calculateAllowance(satisfactionScore: number | null): {
  percentage: number | null;
  nominal: number | null;
} {
  if (satisfactionScore === null) {
    return { percentage: null, nominal: null };
  }

  if (satisfactionScore >= 3.6) {
    return { percentage: 100, nominal: 1000000 };
  }
  if (satisfactionScore >= 3.1) {
    return { percentage: 80, nominal: 800000 };
  }
  if (satisfactionScore >= 2.1) {
    return { percentage: 60, nominal: 600000 };
  }
  if (satisfactionScore >= 1.1) {
    return { percentage: 30, nominal: 300000 };
  }
  return { percentage: 0, nominal: 0 };
}

function calculateSatisfactionScore(
  eventManagerRating: number | null | undefined,
  woRating: number | null | undefined,
  ballroomFacilitiesRating: number | null | undefined,
  ballroomCleanlinessRating: number | null | undefined,
  vendorsRating: number | null | undefined,
  salesRating: number | null | undefined,
  projectManagers: Array<{ rating?: number | null | undefined }> = []
): number | null {
  const ratings: number[] = [];

  if (eventManagerRating) ratings.push(eventManagerRating);
  if (woRating) ratings.push(woRating);
  if (ballroomFacilitiesRating) ratings.push(ballroomFacilitiesRating);
  if (ballroomCleanlinessRating) ratings.push(ballroomCleanlinessRating);
  if (vendorsRating) ratings.push(vendorsRating);
  if (salesRating) ratings.push(salesRating);

  // Add PM ratings
  projectManagers.forEach((pm) => {
    if (pm.rating) ratings.push(pm.rating);
  });

  if (ratings.length === 0) return null;

  const sum = ratings.reduce((a, b) => a + b, 0);
  return sum / ratings.length;
}

export async function createWeddingIndicator(formData: FormData) {
  const { session, error } = await requirePermission({
    module: "vendor-specialist",
    action: "create",
  });

  if (error || !session) {
    return { success: false, error: error || "Unauthorized" };
  }

  if (!mutationLimiter.check(`wedding-indicator:${session.user.id}`)) {
    return {
      success: false,
      error: "Terlalu banyak permintaan. Coba lagi dalam beberapa saat.",
    };
  }

  const data = Object.fromEntries(formData.entries());

  // Parse JSON fields
  let projectManagers = [];
  let postWeddingWishes = {};
  let additionalNotes = "";
  let signatures = {};
  let signatureNames = {};
  let signatureDate = "";

  try {
    const eventManagerNotes = data.eventManagerNotes || "";
    const woNotes = data.woNotes || "";
    const ballroomFacilitiesNotes = data.ballroomFacilitiesNotes || "";
    const ballroomCleanlinessNotes = data.ballroomCleanlinessNotes || "";
    const vendorsNotes = data.vendorsNotes || "";
    const salesNotes = data.salesNotes || "";

    if (data.projectManagers) {
      projectManagers = JSON.parse(data.projectManagers as string);
    }
    if (data.postWeddingWishes) {
      postWeddingWishes = JSON.parse(data.postWeddingWishes as string);
    }
    if (data.notes) {
      additionalNotes = data.notes as string;
    }
    if (data.signatures) {
      signatures = JSON.parse(data.signatures as string);
    }
    if (data.signatureNames) {
      signatureNames = JSON.parse(data.signatureNames as string);
    }
    if (data.signatureDate) {
      signatureDate = data.signatureDate as string;
    }

    // Construct payload for validation
    const payload = {
      coupleName: data.coupleName,
      eventDate: data.eventDate,
      venueId: data.venueId,
      eventManagerName: data.eventManagerName,
      eventManagerRating: data.eventManagerRating
        ? Number(data.eventManagerRating)
        : null,
      eventManagerNotes,
      projectManagers,
      woName: data.woName || "",
      woRating: data.woRating ? Number(data.woRating) : null,
      woNotes,
      ballroomFacilitiesRating: data.ballroomFacilitiesRating
        ? Number(data.ballroomFacilitiesRating)
        : null,
      ballroomFacilitiesNotes,
      ballroomCleanlinessRating: data.ballroomCleanlinessRating
        ? Number(data.ballroomCleanlinessRating)
        : null,
      ballroomCleanlinessNotes,
      vendorsRating: data.vendorsRating ? Number(data.vendorsRating) : null,
      vendorsNotes,
      salesRating: data.salesRating ? Number(data.salesRating) : null,
      salesNotes,
      recommendationScore: Number(data.recommendationScore || 5),
      postWeddingWishes,
      notes: additionalNotes,
    };

    const validatedData = createWeddingIndicatorSchema.parse(payload);

    // Calculate satisfaction score
    const satisfactionScore = calculateSatisfactionScore(
      validatedData.eventManagerRating,
      validatedData.woRating,
      validatedData.ballroomFacilitiesRating,
      validatedData.ballroomCleanlinessRating,
      validatedData.vendorsRating,
      validatedData.salesRating,
      validatedData.projectManagers
    );

    const { percentage: allowancePercentage, nominal: allowanceNominal } =
      calculateAllowance(satisfactionScore);

    // Build questionnaireData
    const questionnaireData = {
      eventManagerNotes: validatedData.eventManagerNotes,
      woNotes: validatedData.woNotes,
      ballroomFacilitiesNotes: validatedData.ballroomFacilitiesNotes,
      ballroomCleanlinessNotes: validatedData.ballroomCleanlinessNotes,
      vendorsNotes: validatedData.vendorsNotes,
      salesNotes: validatedData.salesNotes,
      projectManagers: validatedData.projectManagers,
      postWeddingWishes: validatedData.postWeddingWishes,
      notes: validatedData.notes,
      signatures,
      signatureNames,
      signatureDate,
    };

    // Create in DB
    const indicator = await db.weddingIndicator.create({
      data: {
        coupleName: validatedData.coupleName,
        eventDate: validatedData.eventDate,
        venueId: validatedData.venueId,
        createdById: session.user.profileId,
        eventManagerName: validatedData.eventManagerName,
        eventManagerRating: validatedData.eventManagerRating,
        woName: validatedData.woName,
        woRating: validatedData.woRating,
        ballroomFacilitiesRating: validatedData.ballroomFacilitiesRating,
        ballroomCleanlinessRating: validatedData.ballroomCleanlinessRating,
        vendorsRating: validatedData.vendorsRating,
        salesRating: validatedData.salesRating,
        recommendationScore: validatedData.recommendationScore,
        satisfactionScore,
        allowancePercentage,
        allowanceNominal,
        questionnaireData,
      },
      select: { id: true },
    });

    await logAudit({
      userId: session.user.id,
      action: "wedding_indicator.created",
      result: "success",
      entityType: "wedding_indicator",
      entityId: indicator.id,
    });


    revalidateTag("wedding-indicators", "max");

    return { success: true, id: indicator.id };
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues;
      return {
        success: false,
        error: issues[0]?.message || "Validasi gagal",
      };
    }

    console.error("Wedding indicator creation error:", err);
    return {
      success: false,
      error: "Gagal membuat indikator pernikahan",
    };
  }
}

export async function updateWeddingIndicator(id: string, formData: FormData) {
  const { session, error } = await requirePermission({
    module: "vendor-specialist",
    action: "edit",
  });

  if (error || !session) {
    return { success: false, error: error || "Unauthorized" };
  }

  if (!mutationLimiter.check(`wedding-indicator-update:${session.user.id}`)) {
    return {
      success: false,
      error: "Terlalu banyak permintaan. Coba lagi dalam beberapa saat.",
    };
  }

  const data = Object.fromEntries(formData.entries());

  try {
    let projectManagers = [];
    let postWeddingWishes = {};
    let signatures = {};
    let signatureNames = {};
    let signatureDate = "";

    if (data.projectManagers) {
      projectManagers = JSON.parse(data.projectManagers as string);
    }
    if (data.postWeddingWishes) {
      postWeddingWishes = JSON.parse(data.postWeddingWishes as string);
    }
    if (data.signatures) {
      signatures = JSON.parse(data.signatures as string);
    }
    if (data.signatureNames) {
      signatureNames = JSON.parse(data.signatureNames as string);
    }
    if (data.signatureDate) {
      signatureDate = data.signatureDate as string;
    }

    const payload = {
      coupleName: data.coupleName,
      eventDate: data.eventDate,
      venueId: data.venueId,
      eventManagerName: data.eventManagerName,
      eventManagerRating: data.eventManagerRating
        ? Number(data.eventManagerRating)
        : null,
      eventManagerNotes: data.eventManagerNotes || "",
      projectManagers,
      woName: data.woName || "",
      woRating: data.woRating ? Number(data.woRating) : null,
      woNotes: data.woNotes || "",
      ballroomFacilitiesRating: data.ballroomFacilitiesRating
        ? Number(data.ballroomFacilitiesRating)
        : null,
      ballroomFacilitiesNotes: data.ballroomFacilitiesNotes || "",
      ballroomCleanlinessRating: data.ballroomCleanlinessRating
        ? Number(data.ballroomCleanlinessRating)
        : null,
      ballroomCleanlinessNotes: data.ballroomCleanlinessNotes || "",
      vendorsRating: data.vendorsRating ? Number(data.vendorsRating) : null,
      vendorsNotes: data.vendorsNotes || "",
      salesRating: data.salesRating ? Number(data.salesRating) : null,
      salesNotes: data.salesNotes || "",
      recommendationScore: Number(data.recommendationScore || 5),
      postWeddingWishes,
      notes: data.notes || "",
    };

    const validatedData = updateWeddingIndicatorSchema.parse(payload);

    // Recalculate scores
    const satisfactionScore = calculateSatisfactionScore(
      validatedData.eventManagerRating,
      validatedData.woRating,
      validatedData.ballroomFacilitiesRating,
      validatedData.ballroomCleanlinessRating,
      validatedData.vendorsRating,
      validatedData.salesRating,
      validatedData.projectManagers
    );

    const { percentage: allowancePercentage, nominal: allowanceNominal } =
      calculateAllowance(satisfactionScore);

    const questionnaireData = {
      eventManagerNotes: validatedData.eventManagerNotes,
      woNotes: validatedData.woNotes,
      ballroomFacilitiesNotes: validatedData.ballroomFacilitiesNotes,
      ballroomCleanlinessNotes: validatedData.ballroomCleanlinessNotes,
      vendorsNotes: validatedData.vendorsNotes,
      salesNotes: validatedData.salesNotes,
      projectManagers: validatedData.projectManagers,
      postWeddingWishes: validatedData.postWeddingWishes,
      notes: validatedData.notes,
      signatures,
      signatureNames,
      signatureDate,
    };

    const indicator = await db.weddingIndicator.update({
      where: { id },
      data: {
        coupleName: validatedData.coupleName,
        eventDate: validatedData.eventDate,
        venueId: validatedData.venueId,
        eventManagerName: validatedData.eventManagerName,
        eventManagerRating: validatedData.eventManagerRating,
        woName: validatedData.woName,
        woRating: validatedData.woRating,
        ballroomFacilitiesRating: validatedData.ballroomFacilitiesRating,
        ballroomCleanlinessRating: validatedData.ballroomCleanlinessRating,
        vendorsRating: validatedData.vendorsRating,
        salesRating: validatedData.salesRating,
        recommendationScore: validatedData.recommendationScore,
        satisfactionScore,
        allowancePercentage,
        allowanceNominal,
        questionnaireData,
      },
      select: { id: true },
    });

    await logAudit({
      userId: session.user.id,
      action: "wedding_indicator.updated",
      result: "success",
      entityType: "wedding_indicator",
      entityId: indicator.id,
    });

    revalidateTag("wedding-indicators", "max");

    return { success: true, id: indicator.id };
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues;
      return {
        success: false,
        error: issues[0]?.message || "Validasi gagal",
      };
    }

    console.error("Wedding indicator update error:", err);
    return {
      success: false,
      error: "Gagal memperbarui indikator pernikahan",
    };
  }
}

export async function deleteWeddingIndicator(id: string) {
  const { session, error } = await requirePermission({
    module: "vendor-specialist",
    action: "delete",
  });

  if (error || !session) {
    return { success: false, error: error || "Unauthorized" };
  }

  if (!mutationLimiter.check(`wedding-indicator-delete:${session.user.id}`)) {
    return {
      success: false,
      error: "Terlalu banyak permintaan. Coba lagi dalam beberapa saat.",
    };
  }

  try {
    await db.weddingIndicator.delete({
      where: { id },
    });

    await logAudit({
      userId: session.user.id,
      action: "wedding_indicator.deleted",
      result: "success",
      entityType: "wedding_indicator",
      entityId: id,
    });

    revalidateTag("wedding-indicators", "max");

    return { success: true };
  } catch (err) {
    console.error("Wedding indicator deletion error:", err);
    return {
      success: false,
      error: "Gagal menghapus indikator pernikahan",
    };
  }
}
