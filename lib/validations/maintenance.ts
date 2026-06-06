import { z } from "zod";

// ─── Ticket CRUD ─────────────────────────────────────────────────────────────

export const createMaintenanceTicketSchema = z.object({
  type: z.enum(["TICKET", "PREVENTIVE"]).default("TICKET"),
  description: z.string().trim().min(1, "Deskripsi wajib diisi").max(2000),
  venueId: z.string().min(1, "Venue wajib dipilih"),
  categoryId: z.string().min(1, "Kategori wajib dipilih"),
  priorityId: z.string().min(1, "Prioritas wajib dipilih"),
  statusId: z.string().min(1, "Status wajib dipilih"),
  assignedToId: z.string().optional().nullable(),
  isVendor: z.boolean().default(false),
  isAudit: z.boolean().default(false),
  frequency: z.string().optional().nullable(),
  nextDueDate: z.string().optional().nullable(),
});

export const updateMaintenanceTicketSchema = createMaintenanceTicketSchema.partial().extend({
  id: z.string().min(1),
});

export const updateMaintenanceStatusActionSchema = z.object({
  id: z.string().min(1),
  statusId: z.string().min(1),
});

// ─── Filters ─────────────────────────────────────────────────────────────────

export const maintenanceFilterSchema = z.object({
  type: z.enum(["TICKET", "PREVENTIVE"]).optional(),
  search: z.string().optional(),
  venueId: z.string().optional(),
  brandId: z.string().optional(),
  statusId: z.string().optional(),
  priorityId: z.string().optional(),
  categoryId: z.string().optional(),
  assignedToId: z.string().optional(),
  roleId: z.string().optional(),
  isVendor: z.string().optional(),
  isAudit: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

// ─── Reference Table Schemas ─────────────────────────────────────────────────

export const createMaintenanceCategorySchema = z.object({
  name: z.string().trim().min(1, "Nama kategori wajib diisi").max(100),
});

export const updateMaintenanceCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Nama kategori wajib diisi").max(100),
});

export const createMaintenancePrioritySchema = z.object({
  name: z.string().trim().min(1, "Nama prioritas wajib diisi").max(100),
  deadlineDays: z.coerce.number().int().min(1, "Deadline harus minimal 1 hari"),
});

export const updateMaintenancePrioritySchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(100).optional(),
  deadlineDays: z.coerce.number().int().min(1).optional(),
});

export const createMaintenanceStatusSchema = z.object({
  name: z.string().trim().min(1, "Nama status wajib diisi").max(100),
  order: z.coerce.number().int().default(0),
});

export const updateMaintenanceStatusSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(100).optional(),
  order: z.coerce.number().int().optional(),
});

// ─── Inferred Types ──────────────────────────────────────────────────────────

export type CreateMaintenanceTicketInput = z.infer<typeof createMaintenanceTicketSchema>;
export type UpdateMaintenanceTicketInput = z.infer<typeof updateMaintenanceTicketSchema>;
export type MaintenanceFilterInput = z.infer<typeof maintenanceFilterSchema>;
export type CreateMaintenanceCategoryInput = z.infer<typeof createMaintenanceCategorySchema>;
export type UpdateMaintenanceCategoryInput = z.infer<typeof updateMaintenanceCategorySchema>;
export type CreateMaintenancePriorityInput = z.infer<typeof createMaintenancePrioritySchema>;
export type UpdateMaintenancePriorityInput = z.infer<typeof updateMaintenancePrioritySchema>;
export type CreateMaintenanceStatusInput = z.infer<typeof createMaintenanceStatusSchema>;
export type UpdateMaintenanceStatusInput = z.infer<typeof updateMaintenanceStatusSchema>;
