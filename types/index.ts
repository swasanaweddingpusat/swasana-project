// Re-export common types
export type { Session } from "next-auth";

// Pagination
export type PaginationParams = {
  page?: number;
  limit?: number;
  search?: string;
};

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

// API Response
export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

// User & Auth
export type UserRole = {
  id: string;
  name: string;
  permissions: string[];
};

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  roleId: string | null;
  mustChangePassword: boolean;
};
