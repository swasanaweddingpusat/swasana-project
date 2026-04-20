"use client"

import { useState, useTransition } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Lock, User, Eye, EyeOff, Loader2, AlertTriangle, BarChart3, TrendingUp, Users, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import { updateMyProfile } from "@/actions/profile"
import { AvatarUpload } from "@/components/shared/avatar-upload"

interface ProfileData {
  id: string
  fullName: string | null
  nickName: string | null
  phoneNumber: string | null
  placeOfBirth: string | null
  dateOfBirth: string | null
  ktpAddress: string | null
  currentAddress: string | null
  motherName: string | null
  maritalStatus: string | null
  numberOfChildren: number | null
  lastEducation: string | null
  emergencyContactName: string | null
  emergencyContactRel: string | null
  emergencyContactPhone: string | null
  avatarUrl: string | null
}

interface ProfileClientProps {
  user: {
    id: string
    name: string
    email: string
    image: string | null
    role: string | null
    mustChangePassword: boolean
  }
  profile: ProfileData | null
}

const inputClass = "mt-1 border-[#CCCCCC] bg-[#F9F9F9]"

export function ProfileClient({ user, profile }: ProfileClientProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "security">(
    user.mustChangePassword ? "security" : "overview"
  )

  // Profile form state
  const [form, setForm] = useState({
    fullName: profile?.fullName ?? user.name ?? "",
    nickName: profile?.nickName ?? "",
    phoneNumber: profile?.phoneNumber ?? "",
    placeOfBirth: profile?.placeOfBirth ?? "",
    dateOfBirth: profile?.dateOfBirth ?? "",
    ktpAddress: profile?.ktpAddress ?? "",
    currentAddress: profile?.currentAddress ?? "",
    motherName: profile?.motherName ?? "",
    maritalStatus: profile?.maritalStatus ?? "",
    numberOfChildren: profile?.numberOfChildren?.toString() ?? "",
    lastEducation: profile?.lastEducation ?? "",
    emergencyContactName: profile?.emergencyContactName ?? "",
    emergencyContactRel: profile?.emergencyContactRel ?? "",
    emergencyContactPhone: profile?.emergencyContactPhone ?? "",
  })
  const [savingProfile, setSavingProfile] = useState(false)

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [isPending, startTransition] = useTransition()

  const set = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }))

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      const res = await updateMyProfile({
        ...form,
        numberOfChildren: form.numberOfChildren ? parseInt(form.numberOfChildren) : null,
      })
      if (res.success) toast.success("Profil berhasil disimpan")
      else toast.error(res.error ?? "Gagal menyimpan")
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 12) { toast.error("Password minimal 12 karakter"); return }
    if (newPassword !== confirmPassword) { toast.error("Password tidak cocok"); return }
    startTransition(async () => {
      try {
        const res = await fetch("/api/user/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
        })
        const result = await res.json()
        if (!res.ok) { toast.error(result.error ?? "Gagal mengubah password"); return }
        toast.success("Password berhasil diubah!")
        setCurrentPassword(""); setNewPassword(""); setConfirmPassword("")
        setTimeout(async () => {
          const { signOut } = await import("next-auth/react")
          await signOut({ callbackUrl: "/auth/login?message=Password+berhasil+diubah." })
        }, 1500)
      } catch { toast.error("Terjadi kesalahan") }
    })
  }

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: User },
    { id: "security" as const, label: "Keamanan", icon: Lock },
  ]

  return (
    <div className="space-y-6 p-6">
      {user.mustChangePassword && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Ganti Password Diperlukan</p>
            <p className="text-sm mt-0.5">Anda menggunakan kata sandi sementara. Silakan ganti sebelum melanjutkan.</p>
          </div>
        </div>
      )}

      {/* Profile header */}
      <Card>
        <CardContent className="flex items-center gap-4 py-6">
          <AvatarUpload
            currentUrl={profile?.avatarUrl ?? user.image ?? null}
            name={form.fullName || user.name}
            userId={user.id}
            onUploaded={(url) => { /* avatar updated, shown via preview in component */ }}
          />
          <div>
            <h2 className="text-xl font-semibold">{form.fullName || user.name || "—"}</h2>
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
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => !user.mustChangePassword || tab.id === "security" ? setActiveTab(tab.id) : null}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer",
              activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-gray-900",
              user.mustChangePassword && tab.id !== "security" && "opacity-40 cursor-not-allowed"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Analytics cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="py-4 flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg"><TrendingUp className="h-5 w-5 text-blue-600" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Active Leads</p>
                  <p className="text-base font-semibold text-gray-900">—</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 flex items-center gap-3">
                <div className="p-2 bg-green-50 rounded-lg"><BarChart3 className="h-5 w-5 text-green-600" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Bookings</p>
                  <p className="text-base font-semibold text-gray-900">—</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 flex items-center gap-3">
                <div className="p-2 bg-purple-50 rounded-lg"><Users className="h-5 w-5 text-purple-600" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Customers</p>
                  <p className="text-base font-semibold text-gray-900">—</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 flex items-center gap-3">
                <div className="p-2 bg-orange-50 rounded-lg"><Calendar className="h-5 w-5 text-orange-600" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Events</p>
                  <p className="text-base font-semibold text-gray-900">—</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Profile form */}
          <Card>
            <CardContent className="py-6 space-y-6">
              <h3 className="font-semibold text-sm text-gray-700">Informasi Pribadi</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Nama Lengkap *</Label>
                  <Input className={inputClass} value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Nama lengkap" />
                </div>
                <div>
                  <Label className="text-sm">Nama Panggilan</Label>
                  <Input className={inputClass} value={form.nickName} onChange={(e) => set("nickName", e.target.value)} placeholder="Nama panggilan" />
                </div>
                <div>
                  <Label className="text-sm">No. Telepon</Label>
                  <Input className={inputClass} value={form.phoneNumber} onChange={(e) => set("phoneNumber", e.target.value)} placeholder="08xxxxxxxxxx" />
                </div>
                <div>
                  <Label className="text-sm">Email</Label>
                  <Input className={inputClass} value={user.email} readOnly />
                </div>
                <div>
                  <Label className="text-sm">Tempat Lahir</Label>
                  <Input className={inputClass} value={form.placeOfBirth} onChange={(e) => set("placeOfBirth", e.target.value)} placeholder="Kota kelahiran" />
                </div>
                <div>
                  <Label className="text-sm">Tanggal Lahir</Label>
                  <Input className={inputClass} type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm">Status Pernikahan</Label>
                  <Input className={inputClass} value={form.maritalStatus} onChange={(e) => set("maritalStatus", e.target.value)} placeholder="Belum menikah / Menikah" />
                </div>
                <div>
                  <Label className="text-sm">Pendidikan Terakhir</Label>
                  <Input className={inputClass} value={form.lastEducation} onChange={(e) => set("lastEducation", e.target.value)} placeholder="S1, SMA, dll" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Alamat KTP</Label>
                  <Textarea className={inputClass} value={form.ktpAddress} onChange={(e) => set("ktpAddress", e.target.value)} placeholder="Alamat sesuai KTP" rows={2} />
                </div>
                <div>
                  <Label className="text-sm">Alamat Domisili</Label>
                  <Textarea className={inputClass} value={form.currentAddress} onChange={(e) => set("currentAddress", e.target.value)} placeholder="Alamat tinggal saat ini" rows={2} />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold text-sm text-gray-700 mb-4">Kontak Darurat</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm">Nama</Label>
                    <Input className={inputClass} value={form.emergencyContactName} onChange={(e) => set("emergencyContactName", e.target.value)} placeholder="Nama kontak darurat" />
                  </div>
                  <div>
                    <Label className="text-sm">Hubungan</Label>
                    <Input className={inputClass} value={form.emergencyContactRel} onChange={(e) => set("emergencyContactRel", e.target.value)} placeholder="Orang tua, pasangan, dll" />
                  </div>
                  <div>
                    <Label className="text-sm">No. Telepon</Label>
                    <Input className={inputClass} value={form.emergencyContactPhone} onChange={(e) => set("emergencyContactPhone", e.target.value)} placeholder="08xxxxxxxxxx" />
                  </div>
                </div>
              </div>

              <Button onClick={handleSaveProfile} disabled={savingProfile} className="w-full sm:w-auto">
                {savingProfile ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</> : "Simpan Profil"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === "security" && (
        <Card>
          <CardContent className="py-6">
            <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
              <h3 className="font-semibold text-sm text-gray-700 mb-4">
                {user.mustChangePassword ? "Buat Kata Sandi Baru" : "Ubah Kata Sandi"}
              </h3>
              {!user.mustChangePassword && (
                <div className="grid gap-2">
                  <Label>Password Saat Ini</Label>
                  <div className="relative">
                    <Input type={showCurrentPw ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Password saat ini" required disabled={isPending} />
                    <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowCurrentPw(!showCurrentPw)}>
                      {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
              <div className="grid gap-2">
                <Label>Password Baru</Label>
                <div className="relative">
                  <Input type={showNewPw ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimal 12 karakter" required minLength={12} disabled={isPending} />
                  <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowNewPw(!showNewPw)}>
                    {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Konfirmasi Password Baru</Label>
                <div className="relative">
                  <Input type={showConfirmPw ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Ulangi password baru" required minLength={12} disabled={isPending} />
                  <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowConfirmPw(!showConfirmPw)}>
                    {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</> : "Simpan Password Baru"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
