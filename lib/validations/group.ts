import { z } from "zod";

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
});

export const updateGroupLeaderSchema = z.object({
  groupId: z.string().min(1),
  leaderId: z.string().min(1),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
export type SetMemberTargetInput = z.infer<typeof setMemberTargetSchema>;
export type UpdateGroupLeaderInput = z.infer<typeof updateGroupLeaderSchema>;
