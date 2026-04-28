"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTransition } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { forgotPassword } from "@/actions/auth"

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"form">) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSubmit = async (formData: FormData) => {
    startTransition(async () => {
      try {
        const result = await forgotPassword(formData)

        if (!result.success) {
          toast.error("Gagal mengirim email", {
            description: result.error ?? "Silakan coba lagi.",
          })
        } else {
          toast.success("Link reset terkirim!", {
            description: result.message ?? "Silakan cek email Anda untuk link reset password.",
          })
          router.push(
            "/auth/login?message=" +
              encodeURIComponent(
                "Email reset password telah dikirim! Silakan cek email Anda dan klik link yang diterima."
              )
          )
        }
      } catch {
        toast.error("Terjadi kesalahan", {
          description: "Gagal mengirim email reset password. Silakan coba lagi.",
        })
      }
    })
  }

  return (
    <form
      className={cn("flex flex-col gap-4", className)}
      {...props}
      action={handleSubmit}
    >
      <div className={cn('flex', 'flex-col', 'gap-2')}>
        <h1 className={cn('text-2xl', 'font-bold')}>Lupa kata sandi?</h1>
        <p className={cn('text-balance', 'text-sm', 'text-muted-foreground')}>
          Masukkan email terdaftar untuk mereset kata sandi
        </p>
      </div>
      <div className={cn('grid', 'gap-6')}>
        <div className={cn('grid', 'gap-2')}>
          <Label htmlFor="email" className="font-semibold">
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="email@example.com"
            required
            disabled={isPending}
          />
        </div>
        <Button
          type="submit"
          className={cn('w-full', 'cursor-pointer')}
          disabled={isPending}
        >
          {isPending ? (
            <>
              <Loader2 className={cn('mr-2', 'h-4', 'w-4', 'animate-spin')} />
              Mengirim link...
            </>
          ) : (
            "Kirim link reset"
          )}
        </Button>
      </div>
    </form>
  )
}
