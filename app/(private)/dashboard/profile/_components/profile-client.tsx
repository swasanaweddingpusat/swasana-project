"use client"

import { useState, useTransition } from "react"
const Gender = { MALE: "MALE", FEMALE: "FEMALE" } as const;
type Gender = (typeof Gender)[keyof typeof Gender];
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { Lock, User, Eye, EyeOff, Loader2, AlertTriangle, CreditCard, Users, Briefcase } from "lucide-react"
import { cn } from "@/lib/utils"
import { updateMyProfile } from "@/actions/profile"
import { createEducationLevel } from "@/actions/education-level"
import { AvatarUpload } from "@/components/shared/avatar-upload"
import { SearchableSelect } from "@/components/ui/searchable-select"

interface ProfileData {
  id: string
  employeeNumber: number
  fullName: string | null
  nickName: string | null
  gender: Gender | null
  phoneNumber: string | null
  nik: string | null
  kkNumber: string | null
  placeOfBirth: string | null
  dateOfBirth: string | null
  ktpAddress: string | null
  currentAddress: string | null
  city: string | null
  motherName: string | null
  maritalStatus: string | null
  numberOfChildren: number | null
  lastEducation: string | null
  bankName: string | null
  bankAccountNumber: string | null
  bankAccountHolder: string | null
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
  educationLevels: { id: string; name: string }[]
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className={cn('flex', 'items-center', 'gap-2', 'mb-4')}>
      <div className={cn('flex', 'items-center', 'justify-center', 'w-7', 'h-7', 'rounded-md', 'bg-primary/8', 'text-primary')}>
        <Icon className={cn('h-3.5', 'w-3.5')} />
      </div>
      <span className={cn('text-sm', 'font-semibold', 'text-foreground')}>{title}</span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className={cn('text-xs', 'font-medium', 'text-muted-foreground', 'uppercase', 'tracking-wide')}>{label}</Label>
      {children}
    </div>
  )
}

export function ProfileClient({ user, profile, educationLevels }: ProfileClientProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "security">(
    user.mustChangePassword ? "security" : "overview"
  )

  const [form, setForm] = useState({
    fullName: profile?.fullName ?? user.name ?? "",
    nickName: profile?.nickName ?? "",
    gender: profile?.gender ?? null as Gender | null,
    phoneNumber: profile?.phoneNumber ?? "",
    nik: profile?.nik ?? "",
    kkNumber: profile?.kkNumber ?? "",
    placeOfBirth: profile?.placeOfBirth ?? "",
    dateOfBirth: profile?.dateOfBirth ?? "",
    ktpAddress: profile?.ktpAddress ?? "",
    currentAddress: profile?.currentAddress ?? "",
    city: profile?.city ?? "",
    motherName: profile?.motherName ?? "",
    maritalStatus: profile?.maritalStatus ?? "",
    numberOfChildren: profile?.numberOfChildren?.toString() ?? "",
    lastEducation: profile?.lastEducation ?? "",
    bankName: profile?.bankName ?? "",
    bankAccountNumber: profile?.bankAccountNumber ?? "",
    bankAccountHolder: profile?.bankAccountHolder ?? "",
    emergencyContactName: profile?.emergencyContactName ?? "",
    emergencyContactRel: profile?.emergencyContactRel ?? "",
    emergencyContactPhone: profile?.emergencyContactPhone ?? "",
  })
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [isPending, startTransition] = useTransition()

  const set = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }))
  const [eduOptions, setEduOptions] = useState(() => educationLevels.map((e) => ({ id: e.id, name: e.name })))

  const handleAddEducation = async (name: string) => {
    const res = await createEducationLevel(name, eduOptions.length + 1)
    if (!res.success) { toast.error(res.error); return; }
    setEduOptions((prev) => [...prev, { id: res.item.id, name: res.item.name }])
    set("lastEducation", res.item.id)
  }

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      const res = await updateMyProfile({
        ...form,
        gender: form.gender,
        numberOfChildren: form.numberOfChildren ? parseInt(form.numberOfChildren) : null,
        nik: form.nik || null,
        kkNumber: form.kkNumber || null,
        city: form.city || null,
        bankName: form.bankName || null,
        bankAccountNumber: form.bankAccountNumber || null,
        bankAccountHolder: form.bankAccountHolder || null,
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
        const result = await res.json() as { error?: string }
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
    <div className={cn('space-y-6', 'sm:p-6')}>
      {user.mustChangePassword && (
        <div className={cn('flex', 'items-start', 'gap-3', 'p-4', 'bg-amber-50', 'border', 'border-amber-200', 'rounded-lg', 'text-amber-800')}>
          <AlertTriangle className={cn('h-5', 'w-5', 'shrink-0', 'mt-0.5')} />
          <div>
            <p className={cn('font-semibold', 'text-sm')}>Ganti Password Diperlukan</p>
            <p className={cn('text-sm', 'mt-0.5')}>Anda menggunakan kata sandi sementara. Silakan ganti sebelum melanjutkan.</p>
          </div>
        </div>
      )}

      {/* Profile header */}
      <Card className="border-border/60">
        <CardContent className="">
          <div className={cn('flex', 'items-center', 'gap-5')}>
            <AvatarUpload
              currentUrl={profile?.avatarUrl ?? user.image ?? null}
              name={form.fullName || user.name}
              onUploaded={() => {}}
            />
            <div className={cn('flex-1', 'min-w-0')}>
              <h2 className={cn('text-lg', 'font-semibold', 'truncate')}>{form.fullName || user.name || "—"}</h2>
              <p className={cn('text-sm', 'text-muted-foreground', 'truncate')}>{user.email}</p>
              <div className={cn('flex', 'items-center', 'gap-2', 'mt-1.5', 'flex-wrap')}>
                {profile && (
                  <span className={cn('text-xs', 'text-muted-foreground', 'bg-muted', 'px-2', 'py-0.5', 'rounded', 'font-mono')}>
                    {`EMP-${String(profile.employeeNumber).padStart(4, "0")}`}
                  </span>
                )}
                {user.role && (
                  <span className={cn('text-xs', 'bg-primary', 'text-primary-foreground', 'px-2', 'py-0.5', 'rounded', 'font-medium', 'capitalize')}>
                    {user.role}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className={cn('flex', 'border-b', 'border-border')}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { if (!user.mustChangePassword || tab.id === "security") setActiveTab(tab.id) }}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer",
              activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
              user.mustChangePassword && tab.id !== "security" && "opacity-40 cursor-not-allowed"
            )}
          >
            <tab.icon className={cn('h-4', 'w-4')} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {/* Data Karyawan */}
          <Card className="border-border/60">
            <CardContent className="">
              <SectionHeader icon={Briefcase} title="Data Pribadi" />
              <div className={cn('grid', 'grid-cols-1', 'sm:grid-cols-2', 'gap-x-6', 'gap-y-4')}>
                <Field label="Nama Lengkap *">
                  <Input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Nama lengkap" />
                </Field>
                <Field label="Nama Panggilan">
                  <Input value={form.nickName} onChange={(e) => set("nickName", e.target.value)} placeholder="Nama panggilan" />
                </Field>
                <Field label="Jenis Kelamin">
                  <Select value={form.gender ?? ""} onValueChange={(v) => setForm((p) => ({ ...p, gender: v as Gender }))}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Pilih jenis kelamin" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={Gender.MALE}>Laki-laki</SelectItem>
                      <SelectItem value={Gender.FEMALE}>Perempuan</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Tempat Lahir">
                  <Input value={form.placeOfBirth} onChange={(e) => set("placeOfBirth", e.target.value)} placeholder="Kota kelahiran" />
                </Field>
                <Field label="Tanggal Lahir">
                  <Input type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
                </Field>
                <Field label="NIK">
                  <Input value={form.nik} onChange={(e) => set("nik", e.target.value)} placeholder="16 digit NIK" maxLength={16} />
                </Field>
                <Field label="No. KK">
                  <Input value={form.kkNumber} onChange={(e) => set("kkNumber", e.target.value)} placeholder="16 digit No. KK" maxLength={16} />
                </Field>
                <Field label="No. Telepon">
                  <Input value={form.phoneNumber} onChange={(e) => set("phoneNumber", e.target.value)} placeholder="08xxxxxxxxxx" />
                </Field>
                <Field label="Email">
                  <Input value={user.email} readOnly className={cn('bg-muted', 'text-muted-foreground', 'cursor-not-allowed')} />
                </Field>
                <Field label="Kota">
                  <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Kota domisili" />
                </Field>
                <Field label="Pendidikan Terakhir">
                  <SearchableSelect
                    options={eduOptions}
                    value={form.lastEducation ?? ""}
                    onChange={(v) => set("lastEducation", v)}
                    placeholder="Pilih pendidikan terakhir"
                    searchPlaceholder="Cari pendidikan..."
                    emptyText="Tidak ada data"
                    onAdd={handleAddEducation}
                  />
                </Field>
                <Field label="Alamat Lengkap (KTP)">
                  <Textarea value={form.ktpAddress} onChange={(e) => set("ktpAddress", e.target.value)} placeholder="Alamat sesuai KTP" rows={2} />
                </Field>
                <Field label="Alamat Tinggal Saat Ini">
                  <Textarea value={form.currentAddress} onChange={(e) => set("currentAddress", e.target.value)} placeholder="Alamat tinggal saat ini" rows={2} />
                </Field>
              </div>
            </CardContent>
          </Card>

          {/* Rekening */}
          <Card className="border-border/60">
            <CardContent className="">
              <SectionHeader icon={CreditCard} title="Rekening" />
              <div className={cn('grid', 'grid-cols-1', 'sm:grid-cols-3', 'gap-x-6', 'gap-y-4')}>
                <Field label="Nama Bank">
                  <Input value={form.bankName} onChange={(e) => set("bankName", e.target.value)} placeholder="BCA, BNI, Mandiri, dll" />
                </Field>
                <Field label="Nomor Rekening">
                  <Input value={form.bankAccountNumber} onChange={(e) => set("bankAccountNumber", e.target.value)} placeholder="Nomor rekening" />
                </Field>
                <Field label="Nama Pemilik Rekening">
                  <Input value={form.bankAccountHolder} onChange={(e) => set("bankAccountHolder", e.target.value)} placeholder="Sesuai buku tabungan" />
                </Field>
              </div>
            </CardContent>
          </Card>

          {/* Data Tambahan */}
          <Card className="border-border/60">
            <CardContent className="">
              <SectionHeader icon={User} title="Data Tambahan" />
              <div className={cn('grid', 'grid-cols-1', 'sm:grid-cols-2', 'gap-x-6', 'gap-y-4')}>
                <Field label="Nama Ibu Kandung">
                  <Input value={form.motherName} onChange={(e) => set("motherName", e.target.value)} placeholder="Nama ibu kandung" />
                </Field>
                <Field label="Status Pernikahan">
                  <Select value={form.maritalStatus} onValueChange={(v) => set("maritalStatus", v)}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Pilih status pernikahan" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Belum Menikah">Belum Menikah</SelectItem>
                      <SelectItem value="Menikah">Menikah</SelectItem>
                      <SelectItem value="Cerai Hidup">Cerai Hidup</SelectItem>
                      <SelectItem value="Cerai Mati">Cerai Mati</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Jumlah Anak">
                  <Input type="number" min={0} value={form.numberOfChildren} onChange={(e) => set("numberOfChildren", e.target.value)} placeholder="0" />
                </Field>
              </div>

              <Separator className="my-5" />

              <SectionHeader icon={Users} title="Kontak Darurat" />
              <div className={cn('grid', 'grid-cols-1', 'sm:grid-cols-3', 'gap-x-6', 'gap-y-4')}>
                <Field label="Nama">
                  <Input value={form.emergencyContactName} onChange={(e) => set("emergencyContactName", e.target.value)} placeholder="Nama kontak darurat" />
                </Field>
                <Field label="Hubungan">
                  <Input value={form.emergencyContactRel} onChange={(e) => set("emergencyContactRel", e.target.value)} placeholder="Orang tua, pasangan, dll" />
                </Field>
                <Field label="No. Telepon">
                  <Input value={form.emergencyContactPhone} onChange={(e) => set("emergencyContactPhone", e.target.value)} placeholder="08xxxxxxxxxx" />
                </Field>
              </div>

              <div className={cn('mt-6', 'flex', 'justify-end')}>
                <Button onClick={handleSaveProfile} disabled={savingProfile} className="min-w-32">
                  {savingProfile ? <><Loader2 className={cn('mr-2', 'h-4', 'w-4', 'animate-spin')} /> Menyimpan...</> : "Simpan Profil"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === "security" && (
        <Card className="border-border/60">
          <CardContent className="">
            <div className={cn('flex', 'items-center', 'gap-2', 'mb-6')}>
              <div className={cn('flex', 'items-center', 'justify-center', 'w-7', 'h-7', 'rounded-md', 'bg-primary/8', 'text-primary')}>
                <Lock className={cn('h-3.5', 'w-3.5')} />
              </div>
              <span className={cn('text-sm', 'font-semibold')}>
                {user.mustChangePassword ? "Buat Kata Sandi Baru" : "Ubah Kata Sandi"}
              </span>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className={cn('grid', 'grid-cols-1', 'sm:grid-cols-3', 'gap-x-6', 'gap-y-4')}>
              {!user.mustChangePassword && (
                <Field label="Password Saat Ini">
                  <div className="relative">
                    <Input type={showCurrentPw ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Password saat ini" required disabled={isPending} />
                    <Button type="button" variant="ghost" size="sm" className={cn('absolute', 'right-0', 'top-0', 'h-full', 'px-3', 'hover:bg-transparent')} onClick={() => setShowCurrentPw(!showCurrentPw)}>
                      {showCurrentPw ? <EyeOff className={cn('h-4', 'w-4')} /> : <Eye className={cn('h-4', 'w-4')} />}
                    </Button>
                  </div>
                </Field>
              )}
              <Field label="Password Baru">
                <div className="relative">
                  <Input type={showNewPw ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimal 12 karakter" required minLength={12} disabled={isPending} />
                  <Button type="button" variant="ghost" size="sm" className={cn('absolute', 'right-0', 'top-0', 'h-full', 'px-3', 'hover:bg-transparent')} onClick={() => setShowNewPw(!showNewPw)}>
                    {showNewPw ? <EyeOff className={cn('h-4', 'w-4')} /> : <Eye className={cn('h-4', 'w-4')} />}
                  </Button>
                </div>
              </Field>
              <Field label="Konfirmasi Password Baru">
                <div className="relative">
                  <Input type={showConfirmPw ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Ulangi password baru" required minLength={12} disabled={isPending} />
                  <Button type="button" variant="ghost" size="sm" className={cn('absolute', 'right-0', 'top-0', 'h-full', 'px-3', 'hover:bg-transparent')} onClick={() => setShowConfirmPw(!showConfirmPw)}>
                    {showConfirmPw ? <EyeOff className={cn('h-4', 'w-4')} /> : <Eye className={cn('h-4', 'w-4')} />}
                  </Button>
                </div>
              </Field>
              </div>
              <Button type="submit" className={cn('w-full', 'sm:w-auto')} disabled={isPending}>
                {isPending ? <><Loader2 className={cn('mr-2', 'h-4', 'w-4', 'animate-spin')} /> Menyimpan...</> : "Simpan Password Baru"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
