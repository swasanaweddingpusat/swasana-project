import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function getEmployees(params: {
  page?: number;
  limit?: number;
  search?: string;
  departmentId?: string;
  positionId?: string;
  status?: string;
  employmentType?: string;
}) {
  const page = params.page ?? 1;
  const limit = params.limit ?? 50;
  const skip = (page - 1) * limit;

  const where: Prisma.ProfileWhereInput = {};

  if (params.search) {
    const s = params.search;
    where.OR = [
      { fullName: { contains: s, mode: "insensitive" } },
      { email: { contains: s, mode: "insensitive" } },
      { nik: { contains: s, mode: "insensitive" } },
    ];
  }
  if (params.departmentId) where.departmentId = params.departmentId;
  if (params.positionId) where.positionId = params.positionId;
  if (params.status) where.status = params.status as Prisma.EnumProfileStatusFilter;
  if (params.employmentType)
    where.employmentType = params.employmentType as Prisma.EnumEmploymentTypeNullableFilter;

  const select = {
    id: true,
    employeeNumber: true,
    fullName: true,
    email: true,
    avatarUrl: true,
    status: true,
    employmentType: true,
    joinDate: true,
    phoneNumber: true,
    department: { select: { id: true, name: true } },
    position: { select: { id: true, name: true } },
  } satisfies Prisma.ProfileSelect;

  const [data, total] = await Promise.all([
    db.profile.findMany({
      where,
      select,
      orderBy: { employeeNumber: "asc" },
      skip,
      take: limit,
    }),
    db.profile.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function getEmployeeById(id: string) {
  return db.profile.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      employeeNumber: true,
      email: true,
      fullName: true,
      nickName: true,
      gender: true,
      phoneNumber: true,
      avatarUrl: true,
      nik: true,
      kkNumber: true,
      placeOfBirth: true,
      dateOfBirth: true,
      ktpAddress: true,
      currentAddress: true,
      city: true,
      motherName: true,
      maritalStatus: true,
      numberOfChildren: true,
      lastEducation: true,
      emergencyContactName: true,
      emergencyContactRel: true,
      emergencyContactPhone: true,
      bankName: true,
      bankAccountNumber: true,
      bankAccountHolder: true,
      npwp: true,
      bpjsKesehatan: true,
      bpjsKetenagakerjaan: true,
      religion: true,
      bloodType: true,
      joinDate: true,
      resignDate: true,
      employmentType: true,
      contractStartDate: true,
      contractEndDate: true,
      status: true,
      roleId: true,
      managerId: true,
      dataScope: true,
      departmentId: true,
      positionId: true,
      createdAt: true,
      updatedAt: true,
      department: { select: { id: true, name: true } },
      position: { select: { id: true, name: true } },
      manager: { select: { id: true, fullName: true } },
      role: { select: { id: true, name: true } },
    },
  });
}

export async function getEmployeeDocuments(profileId: string) {
  return db.employeeDocument.findMany({
    where: { profileId },
    select: {
      id: true,
      type: true,
      name: true,
      fileUrl: true,
      fileSize: true,
      expiresAt: true,
      createdAt: true,
      uploader: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getEmploymentHistory(profileId: string) {
  return db.employmentHistory.findMany({
    where: { profileId },
    select: {
      id: true,
      changeType: true,
      description: true,
      oldValue: true,
      newValue: true,
      effectiveDate: true,
      createdAt: true,
      creator: { select: { id: true, fullName: true } },
    },
    orderBy: { effectiveDate: "desc" },
    take: 200,
  });
}

export async function getEmployeesForExport(params: {
  departmentId?: string;
  status?: string;
}) {
  const where: Prisma.ProfileWhereInput = {};
  if (params.departmentId) where.departmentId = params.departmentId;
  if (params.status) where.status = params.status as Prisma.EnumProfileStatusFilter;

  return db.profile.findMany({
    where,
    select: {
      employeeNumber: true,
      fullName: true,
      email: true,
      nik: true,
      phoneNumber: true,
      gender: true,
      religion: true,
      bloodType: true,
      placeOfBirth: true,
      dateOfBirth: true,
      maritalStatus: true,
      lastEducation: true,
      employmentType: true,
      joinDate: true,
      status: true,
      npwp: true,
      bpjsKesehatan: true,
      bpjsKetenagakerjaan: true,
      bankName: true,
      bankAccountNumber: true,
      bankAccountHolder: true,
      department: { select: { name: true } },
      position: { select: { name: true } },
    },
    orderBy: { employeeNumber: "asc" },
    take: 5000,
  });
}

export type EmployeeListItem = Awaited<ReturnType<typeof getEmployees>>["data"][number];
export type EmployeeDetail = NonNullable<Awaited<ReturnType<typeof getEmployeeById>>>;
export type EmployeeDocumentItem = Awaited<ReturnType<typeof getEmployeeDocuments>>[number];
export type EmploymentHistoryItem = Awaited<ReturnType<typeof getEmploymentHistory>>[number];
export type EmployeeExportRow = Awaited<ReturnType<typeof getEmployeesForExport>>[number];
