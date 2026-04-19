export interface LoginInput {
  email: string;
  password: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  password: string;
  confirmPassword: string;
  token?: string;
  force?: boolean;
}

export interface VerifyTokenInput {
  token: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  roleId?: string | null;
  mustChangePassword?: boolean;
}
