import { z } from "zod";

// ─── User ─────────────────────────────────────────────────────────────────────

export const inviteUserSchema = z.object({
  email: z.string().email("Email tidak valid"),
  fullName: z.string().min(2, "Nama minimal 2 karakter"),
  roleId: z.string().min(1, "Role wajib dipilih"),
  managerId: z.string().optional(),
  dataScope: z.enum(["own", "group", "all"]).default("own"),
  groupIds: z.array(z.string().min(1)).optional(),
});

export const updateUserSchema = z.object({
  userId: z.string().min(1),

  // Identity
  fullName: z.string().min(2, "Nama minimal 2 karakter").optional(),
  nickName: z.string().optional(),
  phoneNumber: z.string().optional(),
  roleId: z.string().optional(),
  managerId: z.string().optional(),
  status: z.enum(["active", "inactive", "suspended"]).optional(),
  dataScope: z.enum(["own", "group", "all"]).optional(),

  // Personal data
  placeOfBirth: z.string().optional(),
  dateOfBirth: z.string().optional(),
  ktpAddress: z.string().optional(),
  currentAddress: z.string().optional(),
  motherName: z.string().optional(),
  maritalStatus: z.string().optional(),
  numberOfChildren: z.coerce.number().int().min(0).optional(),
  lastEducation: z.string().optional(),

  // Emergency contact
  emergencyContactName: z.string().optional(),
  emergencyContactRel: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
});

// ─── Roles ────────────────────────────────────────────────────────────────────

export const createRoleSchema = z.object({
  name: z.string().min(2, "Nama role minimal 2 karakter"),
  description: z.string().optional(),
});

export const updateRoleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2, "Nama role minimal 2 karakter"),
  description: z.string().optional(),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
