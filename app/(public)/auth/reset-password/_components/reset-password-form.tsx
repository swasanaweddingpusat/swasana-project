"use client"

import { useState, useTransition, Suspense } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Refresh, Eye, EyeClosed, CheckCircle, CloseCircle } from "@solar-icons/react"
import { toast } from "sonner"
import { useSearchParams, useRouter } from "next/navigation"
import { resetPassword, forceResetPassword } from "@/actions/auth"

// --- Password strength helpers (mirrors lib/validations/auth.ts passwordSchema) ---

interface PasswordCriteria {
  minLength: boolean
  hasLower: boolean
  hasUpper: boolean
  hasNumber: boolean
  hasSymbol: boolean
}

function checkPasswordCriteria(value: string): PasswordCriteria {
  return {
    minLength: value.length >= 12,
    hasLower: /[a-z]/.test(value),
    hasUpper: /[A-Z]/.test(value),
    hasNumber: /[0-9]/.test(value),
    hasSymbol: /[^a-zA-Z0-9]/.test(value),
  }
}

function countMet(criteria: PasswordCriteria): number {
  return Object.values(criteria).filter(Boolean).length
}

type StrengthLevel = "empty" | "weak" | "medium" | "strong"

function getStrengthLevel(met: number): StrengthLevel {
  if (met === 0) return "empty"
  if (met <= 2) return "weak"
  if (met <= 4) return "medium"
  return "strong"
}

const STRENGTH_CONFIG: Record<
  StrengthLevel,
  { label: string; widthClass: string; colorClass: string }
> = {
  empty: { label: "", widthClass: "w-0", colorClass: "bg-muted" },
  weak: { label: "Lemah", widthClass: "w-1/3", colorClass: "bg-destructive" },
  medium: { label: "Sedang", widthClass: "w-2/3", colorClass: "bg-[var(--brand-gold)]" },
  strong: { label: "Kuat", widthClass: "w-full", colorClass: "bg-primary" },
}

const CRITERIA_LABELS: { key: keyof PasswordCriteria; label: string }[] = [
  { key: "minLength", label: "Minimal 12 karakter" },
  { key: "hasUpper", label: "Mengandung huruf kapital (A–Z)" },
  { key: "hasLower", label: "Mengandung huruf kecil (a–z)" },
  { key: "hasNumber", label: "Mengandung angka (0–9)" },
  { key: "hasSymbol", label: "Mengandung simbol (@, #, !, $, …)" },
]

// --- Sub-components ---

function PasswordStrengthBar({ value }: { value: string }) {
  if (!value) return null

  const criteria = checkPasswordCriteria(value)
  const met = countMet(criteria)
  const level = getStrengthLevel(met)
  const config = STRENGTH_CONFIG[level]

  return (
    <div className="mt-2 space-y-1.5">
      {/* Bar */}
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            config.widthClass,
            config.colorClass
          )}
        />
      </div>
      {/* Label */}
      {level !== "empty" && (
        <p
          className={cn(
            "text-xs font-medium",
            level === "weak" && "text-destructive",
            level === "medium" && "text-[var(--brand-gold)]",
            level === "strong" && "text-foreground"
          )}
        >
          {config.label}
        </p>
      )}
    </div>
  )
}

function PasswordChecklist({
  value,
  show,
}: {
  value: string
  show: boolean
}) {
  if (!show) return null

  const criteria = checkPasswordCriteria(value)

  return (
    <ul className="mt-2 space-y-1">
      {CRITERIA_LABELS.map(({ key, label }) => {
        const met = criteria[key]
        return (
          <li key={key} className="flex items-center gap-1.5">
            {met ? (
              <CheckCircle
                weight="BoldDuotone"
                className="h-3.5 w-3.5 shrink-0 text-foreground"
              />
            ) : (
              <CloseCircle
                weight="BoldDuotone"
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              />
            )}
            <span
              className={cn(
                "text-xs transition-colors",
                met ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {label}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function ConfirmPasswordFeedback({
  password,
  confirm,
}: {
  password: string
  confirm: string
}) {
  if (!confirm) return null

  const match = password === confirm
  return (
    <p
      className={cn(
        "mt-1 flex items-center gap-1 text-xs",
        match ? "text-foreground" : "text-destructive"
      )}
    >
      {match ? (
        <CheckCircle weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <CloseCircle weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0" />
      )}
      {match ? "Password cocok" : "Password tidak cocok"}
    </p>
  )
}

// --- Main form ---

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
  const [passwordValue, setPasswordValue] = useState("")
  const [confirmValue, setConfirmValue] = useState("")
  const [passwordFocused, setPasswordFocused] = useState(false)
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
        <div className={cn('text-center', 'space-y-4')}>
          <h2 className={cn('text-xl', 'font-semibold', 'text-destructive')}>
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
        // Force-reset without token: user is authenticated, verify via session
        if (isForceReset && !token) {
          const result = await forceResetPassword(formData)
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
          return
        }

        // Token-based reset (forgot-password email flow or invitation setup)
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
      <div className={cn('flex', 'flex-col', 'gap-2')}>
        <h1 className={cn('text-2xl', 'font-bold')}>Buat kata sandi baru!</h1>
        {isForceReset && (
          <p className={cn('text-sm', 'text-amber-600', 'bg-amber-50', 'border', 'border-amber-200', 'rounded-md', 'px-3', 'py-2')}>
            {message || "Silakan ganti kata sandi sementara Anda untuk keamanan akun."}
          </p>
        )}
        <p className={cn('text-balance', 'text-sm', 'text-muted-foreground')}>
          Untuk keamanan, Anda akan keluar dari semua perangkat setelah kata
          sandi diubah.
        </p>
      </div>
      <div className={cn('grid', 'gap-6')}>
        <div className={cn('grid', 'gap-2')}>
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
              minLength={12}
              value={passwordValue}
              onChange={(e) => setPasswordValue(e.target.value)}
              onFocus={() => setPasswordFocused(true)}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn('absolute', 'right-0', 'top-0', 'h-full', 'px-3', 'py-2', 'hover:bg-transparent')}
              onClick={() => setShowPassword(!showPassword)}
              disabled={isPending}
            >
              {showPassword ? (
                <EyeClosed weight="BoldDuotone" className={cn('h-4', 'w-4')} />
              ) : (
                <Eye weight="BoldDuotone" className={cn('h-4', 'w-4')} />
              )}
            </Button>
          </div>
          <PasswordStrengthBar value={passwordValue} />
          <PasswordChecklist value={passwordValue} show={passwordFocused || passwordValue.length > 0} />
        </div>
        <div className={cn('grid', 'gap-2')}>
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
              minLength={12}
              value={confirmValue}
              onChange={(e) => setConfirmValue(e.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn('absolute', 'right-0', 'top-0', 'h-full', 'px-3', 'py-2', 'hover:bg-transparent')}
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              disabled={isPending}
            >
              {showConfirmPassword ? (
                <EyeClosed weight="BoldDuotone" className={cn('h-4', 'w-4')} />
              ) : (
                <Eye weight="BoldDuotone" className={cn('h-4', 'w-4')} />
              )}
            </Button>
          </div>
          <ConfirmPasswordFeedback password={passwordValue} confirm={confirmValue} />
        </div>
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? (
            <>
              <Refresh weight="BoldDuotone" className={cn('mr-2', 'h-4', 'w-4', 'animate-spin')} />
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
        <div className={cn('flex', 'flex-col', 'gap-6', 'items-center', 'justify-center', 'py-12')}>
          <div className={cn('animate-spin', 'rounded-full', 'h-8', 'w-8', 'border-b-2', 'border-blue-600')} />
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
