"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { Gender } from "@prisma/client";
import { z } from "zod";

const updateProfileSchema = z.object({
  employeeId: z.string().nullable().optional(),
  fullName: z.string().min(1, "Nama lengkap wajib diisi"),
  nickName: z.string().nullable().optional(),
  gender: z.nativeEnum(Gender).nullable().optional(),
  phoneNumber: z.string().nullable().optional(),
  nik: z.string().nullable().optional(),
  kkNumber: z.string().nullable().optional(),
  placeOfBirth: z.string().nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  ktpAddress: z.string().nullable().optional(),
  currentAddress: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  motherName: z.string().nullable().optional(),
  maritalStatus: z.string().nullable().optional(),
  numberOfChildren: z.number().int().nullable().optional(),
  lastEducation: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  bankAccountNumber: z.string().nullable().optional(),
  bankAccountHolder: z.string().nullable().optional(),
  emergencyContactName: z.string().nullable().optional(),
  emergencyContactRel: z.string().nullable().optional(),
  emergencyContactPhone: z.string().nullable().optional(),
});

export async function updateMyProfile(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  if (!mutationLimiter.check(`profile-update:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateProfileSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { dateOfBirth, ...rest } = parsed.data;

  await db.$transaction([
    db.profile.update({
      where: { userId: session.user.id },
      data: {
        ...rest,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      },
    }),
  ]);

  return { success: true };
}

export async function getEducationLevels() {
  return db.educationLevel.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } });
}
