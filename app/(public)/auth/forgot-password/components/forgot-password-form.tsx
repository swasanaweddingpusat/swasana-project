"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTransition } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"form">) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSubmit = async (formData: FormData) => {
    startTransition(async () => {
      try {
        const email = formData.get("email") as string
        const res = await fetch("/api/send-email/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        })

        if (!res.ok) {
          const data = await res.json()
          toast.error("Gagal mengirim email", {
            description: data.error ?? "Silakan coba lagi.",
          })
        } else {
          toast.success("Link reset terkirim!", {
            description: "Silakan cek email Anda untuk link reset password.",
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
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Lupa kata sandi?</h1>
        <p className="text-balance text-sm text-muted-foreground">
          Masukkan email terdaftar untuk mereset kata sandi
        </p>
      </div>
      <div className="grid gap-6">
        <div className="grid gap-2">
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
          className="w-full cursor-pointer"
          disabled={isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
