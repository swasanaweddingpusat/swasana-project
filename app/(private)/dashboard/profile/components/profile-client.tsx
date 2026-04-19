"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"
import { Lock, User, Eye, EyeOff, Loader2, AlertTriangle } from "lucide-react"
import { getInitials } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface ProfileClientProps {
  user: {
    id: string
    name: string
    email: string
    image: string | null
    role: string | null
    mustChangePassword: boolean
  }
}

export function ProfileClient({ user }: ProfileClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"profile" | "security">(
    user.mustChangePassword ? "security" : "profile"
  )

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword.length < 8) {
      toast.error("Password terlalu pendek", {
        description: "Password baru minimal 8 karakter.",
      })
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error("Password tidak cocok", {
        description: "Pastikan kedua password baru sama.",
      })
      return
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/user/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentPassword: user.mustChangePassword ? undefined : currentPassword,
            newPassword,
          }),
        })

        const result = await res.json()

        if (!res.ok) {
          toast.error("Gagal mengubah password", {
            description: result.error ?? "Silakan coba lagi.",
          })
          return
        }

        toast.success("Password berhasil diubah!", {
          description: "Silakan login kembali dengan password baru Anda.",
        })

        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")

        // Sign out to clear the old JWT, then redirect to login
        setTimeout(async () => {
          const { signOut } = await import("next-auth/react")
          await signOut({ callbackUrl: "/auth/login?message=Password+berhasil+diubah.+Silakan+login+kembali." })
        }, 1500)
      } catch {
        toast.error("Terjadi kesalahan", { description: "Silakan coba lagi." })
      }
    })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      {/* Force change password banner */}
      {user.mustChangePassword && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Ganti Password Diperlukan</p>
            <p className="text-sm mt-0.5">
              Anda menggunakan kata sandi sementara. Silakan ganti kata sandi
              sebelum melanjutkan.
            </p>
          </div>
        </div>
      )}

      {/* Profile header card */}
      <Card>
        <CardContent className="flex items-center gap-4 py-6">
          <Avatar className="h-16 w-16">
            <AvatarImage src={user.image ?? ""} />
            <AvatarFallback className="text-lg">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-semibold">{user.name || "—"}</h2>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            {user.role && (
              <span className="inline-block mt-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium capitalize">
                {user.role}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => !user.mustChangePassword && setActiveTab("profile")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === "profile"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-gray-900",
            user.mustChangePassword && "opacity-40 cursor-not-allowed"
          )}
        >
          <User className="h-4 w-4" />
          Informasi Akun
        </button>
        <button
          onClick={() => setActiveTab("security")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === "security"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-gray-900"
          )}
        >
          <Lock className="h-4 w-4" />
          Keamanan
        </button>
      </div>

      {/* Profile Tab */}
      {activeTab === "profile" && (
        <Card>
          <CardContent className="space-y-4 py-6">
            <div className="grid gap-2">
              <Label>Nama Lengkap</Label>
              <Input value={user.name} readOnly className="bg-gray-50" />
            </div>
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input value={user.email} readOnly className="bg-gray-50" />
            </div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Input
                value={user.role ?? "—"}
                readOnly
                className="bg-gray-50 capitalize"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Tab */}
      {activeTab === "security" && (
        <Card>
          <CardContent className="py-6">
            <form onSubmit={handleChangePassword} className="space-y-4">
              <h3 className="font-semibold text-sm text-gray-700 mb-4">
                {user.mustChangePassword
                  ? "Buat Kata Sandi Baru"
                  : "Ubah Kata Sandi"}
              </h3>

              {!user.mustChangePassword && (
                <div className="grid gap-2">
                  <Label htmlFor="currentPassword">Password Saat Ini</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPw ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Masukkan password saat ini"
                      required
                      disabled={isPending}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowCurrentPw(!showCurrentPw)}
                    >
                      {showCurrentPw ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="newPassword">Password Baru</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 8 karakter"
                    required
                    minLength={8}
                    disabled={isPending}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowNewPw(!showNewPw)}
                  >
                    {showNewPw ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="confirmPassword">Konfirmasi Password Baru</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPw ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi password baru"
                    required
                    minLength={8}
                    disabled={isPending}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowConfirmPw(!showConfirmPw)}
                  >
                    {showConfirmPw ? (
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
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Password Baru"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
