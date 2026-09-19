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
  year: z.number().int().min(2000).max(2100),
  amount: z.coerce.number().int().min(0, "Target tidak boleh negatif"),
});

export const deleteMemberTargetSchema = z.object({
  groupId: z.string().min(1),
  profileId: z.string().min(1),
  year: z.number().int().min(2000).max(2100),
});

export const updateGroupLeaderSchema = z.object({
  groupId: z.string().min(1),
  leaderId: z.string().min(1),
});

// ─── Group Venues (many-to-many, informational/filter only) ──────────────────

export const updateGroupVenuesSchema = z.object({
  groupId: z.string().min(1),
  venueIds: z.array(z.string().min(1)).max(200),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
export type SetMemberTargetInput = z.infer<typeof setMemberTargetSchema>;
export type DeleteMemberTargetInput = z.infer<typeof deleteMemberTargetSchema>;
export type UpdateGroupLeaderInput = z.infer<typeof updateGroupLeaderSchema>;
export type UpdateGroupVenuesInput = z.infer<typeof updateGroupVenuesSchema>;
