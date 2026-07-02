import type {
  EmployeeListItem,
  EmployeeDetail,
  EmployeeDocumentItem,
  EmploymentHistoryItem,
} from "@/lib/queries/employees";

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export async function fetchEmployees(params: {
  page?: number;
  limit?: number;
  search?: string;
  departmentId?: string;
  positionId?: string;
  status?: string;
  employmentType?: string;
}): Promise<PaginatedResult<EmployeeListItem>> {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.search) sp.set("search", params.search);
  if (params.departmentId) sp.set("departmentId", params.departmentId);
  if (params.positionId) sp.set("positionId", params.positionId);
  if (params.status) sp.set("status", params.status);
  if (params.employmentType) sp.set("employmentType", params.employmentType);

  const res = await fetch(`/api/hr/employees?${sp.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch employees");
  return res.json() as Promise<PaginatedResult<EmployeeListItem>>;
}

export async function fetchEmployeeById(id: string): Promise<EmployeeDetail> {
  const res = await fetch(`/api/hr/employees/${id}`);
  if (!res.ok) throw new Error("Failed to fetch employee");
  return res.json() as Promise<EmployeeDetail>;
}

export async function fetchEmployeeDocuments(id: string): Promise<EmployeeDocumentItem[]> {
  const res = await fetch(`/api/hr/employees/${id}/documents`);
  if (!res.ok) throw new Error("Failed to fetch documents");
  return res.json() as Promise<EmployeeDocumentItem[]>;
}

export async function fetchEmploymentHistory(id: string): Promise<EmploymentHistoryItem[]> {
  const res = await fetch(`/api/hr/employees/${id}/history`);
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json() as Promise<EmploymentHistoryItem[]>;
}
