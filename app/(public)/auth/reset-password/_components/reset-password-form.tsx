"use client"

import { useState, useTransition, Suspense } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Loader2, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { useSearchParams, useRouter } from "next/navigation"
import { resetPassword } from "@/actions/auth"

export function ResetPasswordForm({
  className,
  token,
  force,
  message,
  setup,
  ...props
}: React.ComponentPropsWithoutRef<"form"> & {
  token?: string | null
  force?: string | null
  message?: string | null
  setup?: string | null
}) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const isForceReset = force === "true"

  if (!token && !isForceReset) {
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

  const handleSubmit = async (formData: FormData) => {
    startTransition(async () => {
      try {
        if (token) formData.set("token", token)
        // setup=true (invitation flow) and force=true both require mustChangePassword reset
        if (force) formData.set("force", force)
        if (setup === "true") formData.set("force", "true")

        const result = await resetPassword(formData)

        if (!result.success) {
          toast.error("Gagal reset password", {
            description: result.error ?? "Silakan coba lagi.",
          })
        } else {
          toast.success("Password berhasil diubah!", {
            description: result.message ?? "Silakan login dengan password baru Anda.",
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

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      {...props}
      action={handleSubmit}
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Buat kata sandi baru!</h1>
        {isForceReset && (
          <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            {message || "Silakan ganti kata sandi sementara Anda untuk keamanan akun."}
          </p>
        )}
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
      <ResetPasswordFormInner />
    </Suspense>
  )
}

function ResetPasswordFormInner() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const force = searchParams.get("force")
  const message = searchParams.get("message")
  const setup = searchParams.get("setup")
  return <ResetPasswordForm token={token} force={force} message={message} setup={setup} />
}
