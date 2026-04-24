"use client"

import { cn } from "@/lib/utils"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState, useTransition, useEffect, useRef } from "react"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, startTransition] = useTransition()
  const searchParams = useSearchParams()
  const toastShownRef = useRef<string | null>(null)
  const router = useRouter()
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard"

  useEffect(() => {
    const message = searchParams.get("message")
    if (message && toastShownRef.current !== message) {
      toastShownRef.current = message
      if (
        message.includes("belum terdaftar") ||
        message.includes("belum diverifikasi") ||
        message.includes("kesalahan") ||
        message.includes("Anda belum") ||
        message.includes("sistem kami")
      ) {
        toast.error("Akses Ditolak", {
          description: message,
          duration: 7000,
        })
      } else {
        toast.success("Berhasil!", {
          description: message,
          duration: 5000,
        })
      }
    }
  }, [searchParams])

  const handleSubmit = async (formData: FormData) => {
    startTransition(async () => {
      try {
        const email = formData.get("email") as string
        const password = formData.get("password") as string

        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        })

        if (result?.error) {
          toast.error("Login gagal", {
            description: "Email atau password salah, atau email belum diverifikasi.",
          })
        } else {
          toast.success("Login berhasil!", {
            description: "Redirecting to dashboard...",
          })
          router.push(callbackUrl)
        }
      } catch {
        toast.error("Terjadi kesalahan", {
          description: "Silakan coba lagi.",
        })
      }
    })
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form className="p-6 md:p-8 flex flex-col justify-center min-h-105" action={handleSubmit}>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col">
                <h1 className="text-2xl font-bold">Welcome back</h1>
                <p className="text-muted-foreground text-balance">
                  Login to your Swasana account
                </p>
              </div>
              <div className="grid gap-3">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  disabled={isPending}
                />
              </div>
              <div className="grid gap-3">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="ml-auto text-sm underline-offset-2 hover:underline text-muted-foreground hover:text-primary"
                  >
                    Forgot your password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    disabled={isPending}
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
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  "Login"
                )}
              </Button>
            </div>
          </form>
          <div className="bg-muted relative hidden md:block overflow-hidden min-h-105">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/thumbnail.png"
              alt="Login background"
              className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
              loading="eager"
            />
          </div>
        </CardContent>
      </Card>
      <div className="text-muted-foreground text-center text-xs text-balance">
        By clicking continue, you agree to our{" "}
        <Link href="#" className="underline underline-offset-4 hover:text-primary">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="#" className="underline underline-offset-4 hover:text-primary">
          Privacy Policy
        </Link>
        .
      </div>
    </div>
  )
}
