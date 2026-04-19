import { z } from "zod";

const passwordSchema = z
  .string()
  .min(12, "Password minimal 12 karakter")
  .regex(/[a-z]/, "Password harus mengandung huruf kecil")
  .regex(/[A-Z]/, "Password harus mengandung huruf kapital")
  .regex(/[0-9]/, "Password harus mengandung angka")
  .regex(/[^a-zA-Z0-9]/, "Password harus mengandung simbol (contoh: @, #, !, $)");

export const loginSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export const registerSchema = z.object({
  fullName: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Email tidak valid"),
  password: passwordSchema,
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Email tidak valid"),
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Password tidak cocok",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Password lama wajib diisi"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Password tidak cocok",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "Password baru tidak boleh sama dengan password lama",
    path: ["newPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
