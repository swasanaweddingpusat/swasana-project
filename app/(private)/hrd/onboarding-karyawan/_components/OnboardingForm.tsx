"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { CloudUpload, UserPlus } from "@solar-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVenues } from "@/hooks/use-venues";
import { useSubmitOnboarding } from "@/hooks/use-employee-onboarding";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormState {
  fullName: string;
  nickName: string;
  joinDate: string;
  divisi: string;
  jabatan: string;
  venueId: string;
  placeOfBirth: string;
  dateOfBirth: string;
  phoneNumber: string;
  email: string;
  maritalStatus: string;
  ktpAddress: string;
  currentAddress: string;
  motherName: string;
  numberOfChildren: string;
  lastEducation: string;
  emergencyContactName: string;
  emergencyContactRel: string;
  emergencyContactPhone: string;
  bankName: string;
  bankAccountNumber: string;
}

type FormErrors = Partial<Record<keyof FormState | "ktpFile" | "kkFile", string>>;

// ─── Constants ────────────────────────────────────────────────────────────────

const INITIAL_FORM: FormState = {
  fullName: "",
  nickName: "",
  joinDate: "",
  divisi: "",
  jabatan: "",
  venueId: "",
  placeOfBirth: "",
  dateOfBirth: "",
  phoneNumber: "",
  email: "",
  maritalStatus: "",
  ktpAddress: "",
  currentAddress: "",
  motherName: "",
  numberOfChildren: "",
  lastEducation: "",
  emergencyContactName: "",
  emergencyContactRel: "",
  emergencyContactPhone: "",
  bankName: "",
  bankAccountNumber: "",
};

const DIVISI_OPTIONS = [
  { value: "Sales", label: "Sales" },
  { value: "Venue Specialist", label: "Venue Specialist" },
  { value: "Operational", label: "Operational" },
  { value: "Finance", label: "Finance" },
  { value: "HR", label: "HR" },
  { value: "MICE", label: "MICE" },
  { value: "IT & Design Creative", label: "IT & Design Creative" },
  { value: "Supporting", label: "Supporting" },
];

const JABATAN_OPTIONS = [
  { value: "Staff", label: "Staff" },
  { value: "Manager", label: "Manager" },
  { value: "Direksi", label: "Direksi" },
  { value: "CEO", label: "CEO" },
];

const MARITAL_OPTIONS = [
  { value: "single", label: "Belum Menikah" },
  { value: "married", label: "Menikah" },
  { value: "divorced_alive", label: "Janda" },
  { value: "divorced_dead", label: "Duda" },
];

// ─── FileUploadField ──────────────────────────────────────────────────────────

function FileUploadField({
  label,
  file,
  onFileChange,
  error,
}: {
  label: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleClick() {
    inputRef.current?.click();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    onFileChange(selected);
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {label}
        <span className="ml-0.5 text-destructive">*</span>
      </Label>
      <button
        type="button"
        onClick={handleClick}
        className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/30 p-8 text-center transition-colors hover:bg-muted/50"
      >
        <CloudUpload weight="BoldDuotone" className="h-8 w-8 text-muted-foreground" />
        {file ? (
          <span className="text-sm font-medium text-foreground">{file.name}</span>
        ) : (
          <span className="text-sm text-muted-foreground">
            Klik untuk upload atau seret file ke sini
            <br />
            <span className="text-xs">JPG, PNG, PDF maks. 5MB</span>
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={handleChange}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ─── OnboardingForm ───────────────────────────────────────────────────────────

export function OnboardingForm() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [ktpFile, setKtpFile] = useState<File | null>(null);
  const [kkFile, setKkFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});

  const { data: venuesData } = useVenues();
  const venues = venuesData ?? [];

  const mutation = useSubmitOnboarding();

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function validate(): boolean {
    const next: FormErrors = {};

    const required: (keyof FormState)[] = [
      "fullName",
      "nickName",
      "joinDate",
      "divisi",
      "jabatan",
      "venueId",
      "placeOfBirth",
      "dateOfBirth",
      "phoneNumber",
      "email",
      "maritalStatus",
      "ktpAddress",
      "currentAddress",
      "motherName",
      "numberOfChildren",
      "lastEducation",
      "emergencyContactName",
      "emergencyContactRel",
      "emergencyContactPhone",
      "bankName",
      "bankAccountNumber",
    ];

    for (const field of required) {
      if (!form[field].trim()) {
        next[field] = "Wajib diisi";
      }
    }

    if (!ktpFile) next.ktpFile = "KTP wajib diupload";
    if (!kkFile) next.kkFile = "Kartu Keluarga wajib diupload";

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validate()) {
      toast.error("Mohon lengkapi semua field yang wajib diisi");
      return;
    }

    const fd = new FormData();
    fd.append("fullName", form.fullName);
    fd.append("nickName", form.nickName);
    fd.append("joinDate", form.joinDate);
    fd.append("divisi", form.divisi);
    fd.append("jabatan", form.jabatan);
    fd.append("venueId", form.venueId);
    fd.append("placeOfBirth", form.placeOfBirth);
    fd.append("dateOfBirth", form.dateOfBirth);
    fd.append("phoneNumber", form.phoneNumber);
    fd.append("email", form.email);
    fd.append("maritalStatus", form.maritalStatus);
    fd.append("ktpAddress", form.ktpAddress);
    fd.append("currentAddress", form.currentAddress);
    fd.append("motherName", form.motherName);
    fd.append("numberOfChildren", form.numberOfChildren);
    fd.append("lastEducation", form.lastEducation);
    fd.append("emergencyContactName", form.emergencyContactName);
    fd.append("emergencyContactRel", form.emergencyContactRel);
    fd.append("emergencyContactPhone", form.emergencyContactPhone);
    fd.append("bankName", form.bankName);
    fd.append("bankAccountNumber", form.bankAccountNumber);
    if (ktpFile) fd.append("ktpFile", ktpFile);
    if (kkFile) fd.append("kkFile", kkFile);

    try {
      const result = await mutation.mutateAsync(fd);
      if (result.success) {
        toast.success(result.message ?? "Data berhasil disimpan");
        setForm(INITIAL_FORM);
        setKtpFile(null);
        setKkFile(null);
        setErrors({});
      } else {
        toast.error(result.error ?? "Gagal menyimpan data");
      }
    } catch {
      toast.error("Terjadi kesalahan. Silakan coba lagi.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* ── Section 1: Informasi Pekerjaan ── */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-heading">INFORMASI PEKERJAAN</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Nama Lengkap */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Nama Lengkap
                <span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Input
                value={form.fullName}
                onChange={(e) => updateField("fullName", e.target.value)}
                placeholder="Masukkan nama lengkap"
                className="rounded-xl"
              />
              {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
            </div>

            {/* Nama Panggilan */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Nama Panggilan
                <span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Input
                value={form.nickName}
                onChange={(e) => updateField("nickName", e.target.value)}
                placeholder="Masukkan nama panggilan"
                className="rounded-xl"
              />
              {errors.nickName && <p className="text-xs text-destructive">{errors.nickName}</p>}
            </div>

            {/* Tanggal Masuk Kerja */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Tanggal Masuk Kerja
                <span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={form.joinDate}
                onChange={(e) => updateField("joinDate", e.target.value)}
                className="rounded-xl"
              />
              {errors.joinDate && <p className="text-xs text-destructive">{errors.joinDate}</p>}
            </div>

            {/* Divisi */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Divisi
                <span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Select value={form.divisi} onValueChange={(v) => updateField("divisi", v)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Pilih divisi" />
                </SelectTrigger>
                <SelectContent>
                  {DIVISI_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.divisi && <p className="text-xs text-destructive">{errors.divisi}</p>}
            </div>

            {/* Jabatan */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Jabatan
                <span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Select value={form.jabatan} onValueChange={(v) => updateField("jabatan", v)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Pilih jabatan" />
                </SelectTrigger>
                <SelectContent>
                  {JABATAN_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.jabatan && <p className="text-xs text-destructive">{errors.jabatan}</p>}
            </div>

            {/* Venue */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Venue
                <span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Select value={form.venueId} onValueChange={(v) => updateField("venueId", v)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Pilih venue" />
                </SelectTrigger>
                <SelectContent>
                  {venues.map((venue) => (
                    <SelectItem key={venue.id} value={venue.id}>
                      {venue.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.venueId && <p className="text-xs text-destructive">{errors.venueId}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Data Pribadi ── */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-heading">DATA PRIBADI</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Tempat Lahir */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Tempat Lahir
                <span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Input
                value={form.placeOfBirth}
                onChange={(e) => updateField("placeOfBirth", e.target.value)}
                placeholder="Masukkan tempat lahir"
                className="rounded-xl"
              />
              {errors.placeOfBirth && (
                <p className="text-xs text-destructive">{errors.placeOfBirth}</p>
              )}
            </div>

            {/* Tanggal Lahir */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Tanggal Lahir
                <span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => updateField("dateOfBirth", e.target.value)}
                className="rounded-xl"
              />
              {errors.dateOfBirth && (
                <p className="text-xs text-destructive">{errors.dateOfBirth}</p>
              )}
            </div>

            {/* No HP */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                No HP (WhatsApp)
                <span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Input
                value={form.phoneNumber}
                onChange={(e) => updateField("phoneNumber", e.target.value)}
                placeholder="Contoh: 08123456789"
                className="rounded-xl"
              />
              {errors.phoneNumber && (
                <p className="text-xs text-destructive">{errors.phoneNumber}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Email
                <span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="contoh@email.com"
                className="rounded-xl"
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            {/* Status Pernikahan */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Status
                <span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Select value={form.maritalStatus} onValueChange={(v) => updateField("maritalStatus", v)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Pilih status" />
                </SelectTrigger>
                <SelectContent>
                  {MARITAL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.maritalStatus && (
                <p className="text-xs text-destructive">{errors.maritalStatus}</p>
              )}
            </div>

            {/* Spacer to push textareas to full width */}
            <div className="hidden sm:block" />

            {/* Alamat KTP */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-sm">
                Alamat Sesuai KTP
                <span className="ml-0.5 text-destructive">*</span>
              </Label>
              <textarea
                className="flex min-h-20 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.ktpAddress}
                onChange={(e) => updateField("ktpAddress", e.target.value)}
                placeholder="Masukkan alamat sesuai KTP"
              />
              {errors.ktpAddress && (
                <p className="text-xs text-destructive">{errors.ktpAddress}</p>
              )}
            </div>

            {/* Alamat Domisili */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-sm">
                Alamat Tinggal Domisili
                <span className="ml-0.5 text-destructive">*</span>
              </Label>
              <textarea
                className="flex min-h-20 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.currentAddress}
                onChange={(e) => updateField("currentAddress", e.target.value)}
                placeholder="Masukkan alamat domisili saat ini"
              />
              {errors.currentAddress && (
                <p className="text-xs text-destructive">{errors.currentAddress}</p>
              )}
            </div>

            {/* Nama Ibu Kandung */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Nama Ibu Kandung
                <span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Input
                value={form.motherName}
                onChange={(e) => updateField("motherName", e.target.value)}
                placeholder="Masukkan nama ibu kandung"
                className="rounded-xl"
              />
              {errors.motherName && (
                <p className="text-xs text-destructive">{errors.motherName}</p>
              )}
            </div>

            {/* Jumlah Anak */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Jumlah Anak
                <span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Input
                type="number"
                min={0}
                value={form.numberOfChildren}
                onChange={(e) => updateField("numberOfChildren", e.target.value)}
                placeholder="0"
                className="rounded-xl"
              />
              {errors.numberOfChildren && (
                <p className="text-xs text-destructive">{errors.numberOfChildren}</p>
              )}
            </div>

            {/* Pendidikan Terakhir */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Pendidikan Terakhir
                <span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Input
                value={form.lastEducation}
                onChange={(e) => updateField("lastEducation", e.target.value)}
                placeholder="Contoh: S1 Manajemen"
                className="rounded-xl"
              />
              {errors.lastEducation && (
                <p className="text-xs text-destructive">{errors.lastEducation}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 3: Kontak Darurat ── */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-heading">KONTAK DARURAT</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Nama Kontak */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Nama Kontak
                <span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Input
                value={form.emergencyContactName}
                onChange={(e) => updateField("emergencyContactName", e.target.value)}
                placeholder="Masukkan nama kontak darurat"
                className="rounded-xl"
              />
              {errors.emergencyContactName && (
                <p className="text-xs text-destructive">{errors.emergencyContactName}</p>
              )}
            </div>

            {/* Hubungan */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Hubungan
                <span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Input
                value={form.emergencyContactRel}
                onChange={(e) => updateField("emergencyContactRel", e.target.value)}
                placeholder="Contoh: Orang Tua, Pasangan"
                className="rounded-xl"
              />
              {errors.emergencyContactRel && (
                <p className="text-xs text-destructive">{errors.emergencyContactRel}</p>
              )}
            </div>

            {/* No Kontak Darurat */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                No Kontak Darurat
                <span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Input
                value={form.emergencyContactPhone}
                onChange={(e) => updateField("emergencyContactPhone", e.target.value)}
                placeholder="Contoh: 08123456789"
                className="rounded-xl"
              />
              {errors.emergencyContactPhone && (
                <p className="text-xs text-destructive">{errors.emergencyContactPhone}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 4: Rekening ── */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-heading">REKENING</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Nama Bank */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Nama Bank
                <span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Input
                value={form.bankName}
                onChange={(e) => updateField("bankName", e.target.value)}
                placeholder="Contoh: BCA, Mandiri, BRI"
                className="rounded-xl"
              />
              {errors.bankName && <p className="text-xs text-destructive">{errors.bankName}</p>}
            </div>

            {/* Nomer Rekening */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Nomer Rekening
                <span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Input
                value={form.bankAccountNumber}
                onChange={(e) => updateField("bankAccountNumber", e.target.value)}
                placeholder="Masukkan nomor rekening"
                className="rounded-xl font-mono"
              />
              {errors.bankAccountNumber && (
                <p className="text-xs text-destructive">{errors.bankAccountNumber}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 5: Upload Dokumen ── */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-heading">UPLOAD DOKUMEN</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FileUploadField
              label="Upload KTP (Foto/Scan)"
              file={ktpFile}
              onFileChange={setKtpFile}
              error={errors.ktpFile}
            />
            <FileUploadField
              label="Upload Kartu Keluarga"
              file={kkFile}
              onFileChange={setKkFile}
              error={errors.kkFile}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Submit ── */}
      <Button
        type="submit"
        size="lg"
        disabled={mutation.isPending}
        className="w-full rounded-full"
      >
        <UserPlus weight="BoldDuotone" className="mr-2 h-5 w-5" />
        {mutation.isPending ? "Menyimpan..." : "Daftarkan Karyawan"}
      </Button>
    </form>
  );
}
