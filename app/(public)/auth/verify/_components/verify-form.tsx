"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { verifyEmail } from "@/actions/auth"
import { cn } from "../../../../../lib/utils";

type State = "loading" | "verified" | "error"

export function VerifyForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")
  const message = searchParams.get("message")

  const noToken = !token && !message;
  const [state, setState] = useState<State>(noToken ? "error" : "loading")
  const [errorMessage, setErrorMessage] = useState<string>(noToken ? "Token tidak valid." : "")

  useEffect(() => {
    if (message && !token) {
      toast.info(message)
      const timer = setTimeout(() => { router.push("/auth/login") }, 3000)
      return () => clearTimeout(timer)
    }

    if (!token) return

    verifyEmail(token).then((result) => {
      if (result.success) {
        setState("verified")
        toast.success("Email berhasil diverifikasi!")
        if (result.setupToken) {
          setTimeout(() => {
            router.push(`/auth/reset-password?token=${result.setupToken}&setup=true`)
          }, 1500)
        }
      } else {
        setErrorMessage(result.error ?? "Verifikasi gagal.")
        setState("error")
        toast.error(result.error ?? "Verifikasi gagal.")
      }
    })
  }, [token, message, router])

  return (
    <Card className={cn('w-full', 'max-w-sm')}>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Verifikasi Email</CardTitle>
      </CardHeader>
      <CardContent className={cn('flex', 'flex-col', 'items-center', 'gap-4', 'text-center')}>
        {state === "loading" && (
          <>
            <Loader2 className={cn('h-10', 'w-10', 'animate-spin', 'text-blue-600')} />
            <p className="text-muted-foreground">Memverifikasi email...</p>
          </>
        )}

        {state === "verified" && (
          <>
            <CheckCircle2 className={cn('h-10', 'w-10', 'text-green-600')} />
            <p className="font-semibold">Email berhasil diverifikasi!</p>
            <p className={cn('text-sm', 'text-muted-foreground')}>Mengarahkan ke halaman buat password...</p>
            <Loader2 className={cn('h-5', 'w-5', 'animate-spin', 'text-muted-foreground')} />
          </>
        )}

        {state === "error" && (
          <>
            <XCircle className={cn('h-10', 'w-10', 'text-red-600')} />
            <p className={cn('font-semibold', 'text-red-600')}>Verifikasi Gagal</p>
            <p className={cn('text-sm', 'text-muted-foreground')}>{errorMessage}</p>
            <Link href="/auth/login">
              <Button variant="outline" className="w-full">Kembali ke Login</Button>
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  )
}
