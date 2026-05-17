import { z } from "zod";

// ─── User ─────────────────────────────────────────────────────────────────────

export const inviteUserSchema = z.object({
  email: z.string().email("Email tidak valid"),
  fullName: z.string().min(2, "Nama minimal 2 karakter"),
  roleId: z.string().min(1, "Role wajib dipilih"),
  managerId: z.string().optional(),
  dataScope: z.enum(["own", "group", "all"]).default("own"),
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

// ─── Groups ───────────────────────────────────────────────────────────────────

export const createGroupSchema = z.object({
  name: z.string().min(2, "Nama grup minimal 2 karakter"),
  description: z.string().optional(),
  leaderId: z.string().optional(),
});

export const updateGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2, "Nama grup minimal 2 karakter").optional(),
  description: z.string().optional(),
  leaderId: z.string().nullable().optional(),
});

// ─── My Team ──────────────────────────────────────────────────────────────────

export const setMemberTargetSchema = z.object({
  groupId: z.string().min(1),
  profileId: z.string().min(1),
  amount: z.coerce.number().int().min(0, "Target tidak boleh negatif"),
  startDate: z.string().min(1, "Tanggal mulai wajib diisi"),
  endDate: z.string().min(1, "Tanggal selesai wajib diisi"),
});

export const updateGroupLeaderSchema = z.object({
  groupId: z.string().min(1),
  leaderId: z.string().min(1),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
export type SetMemberTargetInput = z.infer<typeof setMemberTargetSchema>;
export type UpdateGroupLeaderInput = z.infer<typeof updateGroupLeaderSchema>;
