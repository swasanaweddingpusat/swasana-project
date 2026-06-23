import { z } from "zod";

export const createEmployeeSchema = z.object({
  email: z.string().email("Email tidak valid"),
  fullName: z.string().min(1, "Nama lengkap wajib diisi"),
  nickName: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE"]).optional(),
  phoneNumber: z.string().optional(),
  nik: z.string().optional(),
  kkNumber: z.string().optional(),
  placeOfBirth: z.string().optional(),
  dateOfBirth: z.coerce.date().optional(),
  religion: z.enum(["islam", "kristen", "katolik", "hindu", "buddha", "konghucu"]).optional(),
  bloodType: z.string().optional(),
  ktpAddress: z.string().optional(),
  currentAddress: z.string().optional(),
  city: z.string().optional(),
  motherName: z.string().optional(),
  maritalStatus: z.string().optional(),
  numberOfChildren: z.number().int().min(0).optional(),
  lastEducation: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactRel: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankAccountHolder: z.string().optional(),
  npwp: z.string().optional(),
  bpjsKesehatan: z.string().optional(),
  bpjsKetenagakerjaan: z.string().optional(),
  departmentId: z.string().optional(),
  positionId: z.string().optional(),
  managerId: z.string().optional(),
  roleId: z.string().optional(),
  dataScope: z.enum(["own", "group", "all"]).optional(),
  employmentType: z.enum(["permanent", "contract", "probation", "intern"]).optional(),
  joinDate: z.coerce.date().optional(),
  contractStartDate: z.coerce.date().optional(),
  contractEndDate: z.coerce.date().optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.omit({ email: true }).partial();

export const employeeListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
  departmentId: z.string().optional(),
  positionId: z.string().optional(),
  status: z.enum(["active", "inactive", "suspended"]).optional(),
  employmentType: z.enum(["permanent", "contract", "probation", "intern"]).optional(),
});

export const uploadDocumentSchema = z.object({
  type: z.enum(["ktp", "npwp", "bpjs_kes", "bpjs_tk", "contract", "ijazah", "certificate", "other"]),
  name: z.string().min(1, "Nama dokumen wajib diisi"),
  expiresAt: z.coerce.date().optional(),
});

export const addHistorySchema = z.object({
  changeType: z.enum(["promotion", "transfer", "demotion", "status_change", "contract_renewal", "salary_change", "join", "resign", "other"]),
  description: z.string().min(1, "Deskripsi wajib diisi"),
  oldValue: z.string().optional(),
  newValue: z.string().optional(),
  effectiveDate: z.coerce.date(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type EmployeeListQuery = z.infer<typeof employeeListQuerySchema>;
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
export type AddHistoryInput = z.infer<typeof addHistorySchema>;
