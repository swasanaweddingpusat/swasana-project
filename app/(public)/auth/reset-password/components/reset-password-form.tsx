"use client"

import { useState, useTransition, useEffect, Suspense, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Loader2, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { useSearchParams, useRouter } from "next/navigation"

export function ResetPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"form">) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const toastShownRef = useRef<string | null>(null)

  useEffect(() => {
    const checkToken = async () => {
      const token = searchParams.get("token")
      const forceReset = searchParams.get("force")
      const message = searchParams.get("message")

      if (forceReset === "true") {
        setTokenValid(true)
        setIsLoading(false)
        const toastKey = `force-${message}`
        if (toastShownRef.current !== toastKey) {
          toastShownRef.current = toastKey
          toast.warning("Reset Password Diperlukan", {
            description:
              message ||
              "Silakan ganti kata sandi sementara Anda untuk keamanan akun.",
            duration: 5000,
          })
        }
        return
      }

      if (!token) {
        toast.error("Link tidak valid", {
          description:
            "Link reset password tidak valid atau sudah kedaluwarsa. Silakan minta link baru.",
          duration: 5000,
        })
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch("/api/auth/validate-reset-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        })

        const result = await response.json()

        if (!response.ok || !result.valid) {
          toast.error("Link tidak valid", {
            description:
              result.error ||
              "Link reset password tidak valid atau sudah kedaluwarsa. Silakan minta link baru.",
            duration: 5000,
          })
          return
        }

        setTokenValid(true)
        if (toastShownRef.current !== "token-valid") {
          toastShownRef.current = "token-valid"
          toast.success("Link valid!", {
            description: "Silakan masukkan password baru Anda.",
            duration: 3000,
          })
        }
      } catch {
        toast.error("Terjadi kesalahan", {
          description: "Gagal memverifikasi token reset password.",
          duration: 5000,
        })
      } finally {
        setIsLoading(false)
      }
    }

    checkToken()
  }, [searchParams, router])

  const handleSubmit = async (formData: FormData) => {
    startTransition(async () => {
      try {
        const token = searchParams.get("token")
        const password = formData.get("password") as string
        const confirmPassword = formData.get("confirmPassword") as string

        if (password !== confirmPassword) {
          toast.error("Password tidak cocok", {
            description: "Pastikan kedua password sama.",
          })
          return
        }

        if (password.length < 8) {
          toast.error("Password terlalu pendek", {
            description: "Password minimal 8 karakter.",
          })
          return
        }

        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password }),
        })

        const result = await res.json()

        if (!res.ok) {
          toast.error("Gagal reset password", {
            description: result.error ?? "Silakan coba lagi.",
          })
        } else {
          toast.success("Password berhasil diubah!", {
            description: "Silakan login dengan password baru Anda.",
          })
          router.push("/auth/login")
        }
      } catch {
        toast.error("Terjadi kesalahan", {
          description: "Silakan coba lagi.",
        })
      }
    })
  }

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex flex-col gap-6 items-center justify-center py-12",
          className
        )}
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <p className="text-muted-foreground">
          Memproses link reset password...
        </p>
      </div>
    )
  }

  if (!tokenValid) {
    return (
      <div
        className={cn(
          "flex flex-col gap-6 items-center justify-center py-12",
          className
        )}
      >
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold text-red-600">
            Link Tidak Valid
          </h2>
          <p className="text-muted-foreground">
            Link reset password tidak valid atau sudah kedaluwarsa.
          </p>
          <Button>
            <Link href="/auth/forgot-password">Minta Link Baru</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      {...props}
      action={handleSubmit}
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Buat kata sandi baru!</h1>
        <p className="text-balance text-sm text-muted-foreground">
          Untuk keamanan, Anda akan keluar dari semua perangkat setelah kata
          sandi diubah.
        </p>
      </div>
      <div className="grid gap-6">
        <div className="grid gap-2">
          <Label htmlFor="password" className="font-semibold">
            Pilih kata sandi baru
          </Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Masukkan kata sandi"
              required
              disabled={isPending}
              minLength={8}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isPending}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirmPassword" className="font-semibold">
            Konfirmasi
          </Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              name="confirmPassword"
              placeholder="Konfirmasi kata sandi"
              type={showConfirmPassword ? "text" : "password"}
              required
              disabled={isPending}
              minLength={8}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              disabled={isPending}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Membuat kata sandi...
            </>
          ) : (
            "Buat kata sandi"
          )}
        </Button>
      </div>
    </form>
  )
}

export function ResetPasswordWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6 items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}
