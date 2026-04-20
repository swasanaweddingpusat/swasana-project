"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { verifyEmail } from "@/actions/auth"

type State = "loading" | "verified" | "error"

export function VerifyForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")
  const message = searchParams.get("message")

  const [state, setState] = useState<State>("loading")
  const [errorMessage, setErrorMessage] = useState<string>("")

  useEffect(() => {
    // If only a message param exists (no token), show it and redirect
    if (message && !token) {
      toast.info(message)
      const timer = setTimeout(() => {
        router.push("/auth/login")
      }, 3000)
      return () => clearTimeout(timer)
    }

    if (!token) {
      setErrorMessage("Token tidak valid.")
      setState("error")
      return
    }

    verifyEmail(token).then((result) => {
      if (result.success) {
        setState("verified")
        toast.success("Email berhasil diverifikasi!")
      } else {
        setErrorMessage(result.error ?? "Verifikasi gagal.")
        setState("error")
        toast.error(result.error ?? "Verifikasi gagal.")
      }
    })
  }, [token, message, router])

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Verifikasi Email</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 text-center">
        {state === "loading" && (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            <p className="text-muted-foreground">Memverifikasi email...</p>
          </>
        )}

        {state === "verified" && (
          <>
            <CheckCircle2 className="h-10 w-10 text-green-600" />
            <p className="font-semibold">Email berhasil diverifikasi!</p>
            <p className="text-sm text-muted-foreground">
              Email terverifikasi, silakan login
            </p>
            <Link href="/auth/login">
              <Button className="w-full">Masuk Sekarang</Button>
            </Link>
          </>
        )}

        {state === "error" && (
          <>
            <XCircle className="h-10 w-10 text-red-600" />
            <p className="font-semibold text-red-600">Verifikasi Gagal</p>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
            <Link href="/auth/login">
              <Button variant="outline" className="w-full">Kembali ke Login</Button>
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  )
}
