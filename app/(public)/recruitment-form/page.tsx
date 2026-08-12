"use client";

import React, { useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  UserCircle,
  Letter,
  Phone,
  MapPoint,
  Calendar,
  Diploma,
  Suitcase,
  Camera,
  File,
  CheckCircle,
  LockKeyhole,
  Buildings,
  Dollar,
  UsersGroupTwoRounded,
  ClipboardList,
} from "@solar-icons/react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface RecruitmentInfo {
  position: string;
  department: string;
  company: string | null;
  level: string | null;
  workLocation: string | null;
  quota: number;
  minEducation: string | null;
  minExperience: string | null;
  jobDescriptions: string[];
  isWalkinInterview: boolean;
}

interface CandidateForm {
  fullName: string;
  email: string;
  phoneNumber: string;
  address: string;
  birthPlace: string;
  birthDate: string;
  lastEducation: string;
  major: string;
  workExperienceYears: string;
  workHistory: string;
}

const EDUCATION_OPTIONS = [
  { value: "SD", label: "SD" },
  { value: "SMP", label: "SMP" },
  { value: "SMA/SMK", label: "SMA/SMK" },
  { value: "D1", label: "D1" },
  { value: "D2", label: "D2" },
  { value: "D3", label: "D3" },
  { value: "D4/S1", label: "D4/S1" },
  { value: "S2", label: "S2" },
  { value: "S3", label: "S3" },
];

// ─── Inner content (uses useSearchParams — must be inside Suspense) ──────────

function RecruitmentFormContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [step, setStep] = useState<"code" | "form" | "done">("code");
  const [accessCode, setAccessCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState("");

  const [recruitmentInfo, setRecruitmentInfo] =
    useState<RecruitmentInfo | null>(null);

  const [form, setForm] = useState<CandidateForm>({
    fullName: "",
    email: "",
    phoneNumber: "",
    address: "",
    birthPlace: "",
    birthDate: "",
    lastEducation: "",
    major: "",
    workExperienceYears: "",
    workHistory: "",
  });

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function updateForm(field: keyof CandidateForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function uploadFile(
    file: File,
    type: "photo" | "cv"
  ): Promise<string | null> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("token", token);
    fd.append("accessCode", accessCode);
    fd.append("type", type);
    const res = await fetch("/api/recruitment-form/upload", {
      method: "POST",
      body: fd,
    });
    const data: unknown = await res.json();
    if (!res.ok) {
      const msg =
        data !== null &&
        typeof data === "object" &&
        "error" in data &&
        typeof (data as Record<string, unknown>).error === "string"
          ? (data as Record<string, string>).error
          : "Gagal upload file";
      toast.error(msg);
      return null;
    }
    if (
      data !== null &&
      typeof data === "object" &&
      "key" in data &&
      typeof (data as Record<string, unknown>).key === "string"
    ) {
      return (data as Record<string, string>).key;
    }
    return null;
  }

  // ── Step: access code ──────────────────────────────────────────────────────

  async function handleValidate(e: React.FormEvent) {
    e.preventDefault();
    setCodeError("");
    setCodeLoading(true);
    try {
      const res = await fetch("/api/recruitment-form/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, accessCode: accessCode.trim().toUpperCase() }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        const msg =
          data !== null &&
          typeof data === "object" &&
          "error" in data &&
          typeof (data as Record<string, unknown>).error === "string"
            ? (data as Record<string, string>).error
            : "Kode akses tidak valid";
        setCodeError(msg);
        return;
      }
      if (
        data !== null &&
        typeof data === "object" &&
        "recruitmentRequest" in data
      ) {
        setRecruitmentInfo(
          (data as Record<string, unknown>)
            .recruitmentRequest as RecruitmentInfo
        );
      }
      setStep("form");
    } catch {
      setCodeError("Terjadi kesalahan jaringan. Coba lagi.");
    } finally {
      setCodeLoading(false);
    }
  }

  // ── Step: submit form ──────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.fullName.trim()) {
      toast.error("Nama lengkap wajib diisi");
      return;
    }
    if (!form.email.trim()) {
      toast.error("Email wajib diisi");
      return;
    }
    if (!form.phoneNumber.trim()) {
      toast.error("Nomor telepon wajib diisi");
      return;
    }

    setSubmitting(true);
    try {
      let photoKey: string | null = null;
      let cvKey: string | null = null;

      if (photoFile) {
        photoKey = await uploadFile(photoFile, "photo");
        if (photoKey === null) {
          setSubmitting(false);
          return;
        }
      }

      if (cvFile) {
        cvKey = await uploadFile(cvFile, "cv");
        if (cvKey === null) {
          setSubmitting(false);
          return;
        }
      }

      const payload = {
        token,
        accessCode: accessCode.trim().toUpperCase(),
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phoneNumber: form.phoneNumber.trim(),
        address: form.address.trim() || null,
        birthPlace: form.birthPlace.trim() || null,
        birthDate: form.birthDate || null,
        lastEducation: form.lastEducation || null,
        major: form.major.trim() || null,
        workExperienceYears: form.workExperienceYears
          ? parseInt(form.workExperienceYears, 10)
          : null,
        workHistory: form.workHistory.trim() || null,
        photoUrl: photoKey,
        cvUrl: cvKey,
      };

      const res = await fetch("/api/recruitment-form/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data: unknown = await res.json();
      if (!res.ok) {
        const msg =
          data !== null &&
          typeof data === "object" &&
          "error" in data &&
          typeof (data as Record<string, unknown>).error === "string"
            ? (data as Record<string, string>).error
            : "Gagal mengirim lamaran";
        toast.error(msg);
        return;
      }

      setStep("done");
    } catch {
      toast.error("Terjadi kesalahan jaringan. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Render: invalid link ──────────────────────────────────────────────────

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md rounded-2xl shadow-sm">
          <CardContent className="p-8 text-center">
            <h1 className="font-heading text-2xl font-bold text-foreground">
              Link Tidak Valid
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Link yang Anda akses tidak memiliki token yang valid. Hubungi tim
              HR untuk mendapatkan link yang benar.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Render: access code step ──────────────────────────────────────────────

  if (step === "code") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-6">
          {/* Branding */}
          <div className="text-center">
            <p className="font-logo text-xl font-semibold text-foreground">
              Swasana Wedding
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Sistem Rekrutmen Internal
            </p>
          </div>

          {/* Code card */}
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <div className="mb-5 flex flex-col items-center gap-2 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <LockKeyhole
                    weight="BoldDuotone"
                    className="h-6 w-6 text-primary"
                  />
                </div>
                <h1 className="font-heading text-xl font-bold text-foreground">
                  Form Lamaran Kerja
                </h1>
                <p className="text-sm text-muted-foreground">
                  Masukkan kode akses yang diberikan oleh HR untuk melanjutkan.
                </p>
              </div>

              <form onSubmit={handleValidate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="accessCode" className="text-sm font-medium">
                    Kode Akses
                  </Label>
                  <Input
                    id="accessCode"
                    type="text"
                    value={accessCode}
                    onChange={(e) =>
                      setAccessCode(e.target.value.toUpperCase().slice(0, 6))
                    }
                    placeholder="Contoh: AB1234"
                    maxLength={6}
                    className="rounded-xl text-center font-mono text-2xl tracking-[0.4em] uppercase"
                    autoFocus
                    autoComplete="off"
                    disabled={codeLoading}
                  />
                </div>

                {codeError && (
                  <p className="text-center text-sm text-destructive">
                    {codeError}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full rounded-full"
                  disabled={codeLoading || accessCode.length < 6}
                >
                  {codeLoading ? "Memverifikasi..." : "Verifikasi Kode"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ─── Render: done step ────────────────────────────────────────────────────

  if (step === "done") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm rounded-2xl shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="flex justify-center">
              <CheckCircle
                weight="BoldDuotone"
                className="h-16 w-16 text-primary"
              />
            </div>
            <h1 className="mt-4 font-heading text-2xl font-bold text-foreground">
              Lamaran Berhasil Dikirim!
            </h1>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Terima kasih telah mengisi form lamaran kerja. Tim HR kami akan
              meninjau lamaran Anda dan menghubungi Anda jika sesuai dengan
              kualifikasi yang dibutuhkan.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Render: form step ────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div>
          <p className="font-logo text-lg font-semibold text-foreground">
            Swasana Wedding
          </p>
          <h1 className="mt-1 font-heading text-2xl font-bold text-foreground">
            Form Lamaran Kerja
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Silakan lengkapi data diri Anda di bawah ini.
          </p>
        </div>

        {/* Recruitment info card */}
        {recruitmentInfo && (
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <h2 className="mb-4 font-heading text-lg font-semibold text-foreground">
                Informasi Lowongan
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InfoRow
                  icon={
                    <Suitcase
                      weight="BoldDuotone"
                      className="h-4 w-4 text-primary"
                    />
                  }
                  label="Posisi"
                  value={recruitmentInfo.position}
                />
                <InfoRow
                  icon={
                    <Buildings
                      weight="BoldDuotone"
                      className="h-4 w-4 text-primary"
                    />
                  }
                  label="Departemen"
                  value={recruitmentInfo.department}
                />
                {recruitmentInfo.company && (
                  <InfoRow
                    icon={
                      <Buildings
                        weight="BoldDuotone"
                        className="h-4 w-4 text-primary"
                      />
                    }
                    label="Perusahaan"
                    value={recruitmentInfo.company}
                  />
                )}
                {recruitmentInfo.level && (
                  <InfoRow
                    icon={
                      <Dollar
                        weight="BoldDuotone"
                        className="h-4 w-4 text-primary"
                      />
                    }
                    label="Level"
                    value={recruitmentInfo.level}
                  />
                )}
                {recruitmentInfo.workLocation && (
                  <InfoRow
                    icon={
                      <MapPoint
                        weight="BoldDuotone"
                        className="h-4 w-4 text-primary"
                      />
                    }
                    label="Lokasi Kerja"
                    value={recruitmentInfo.workLocation}
                  />
                )}
                <InfoRow
                  icon={
                    <UsersGroupTwoRounded
                      weight="BoldDuotone"
                      className="h-4 w-4 text-primary"
                    />
                  }
                  label="Kuota"
                  value={`${recruitmentInfo.quota} orang`}
                />
                {recruitmentInfo.minEducation && (
                  <InfoRow
                    icon={
                      <Diploma
                        weight="BoldDuotone"
                        className="h-4 w-4 text-primary"
                      />
                    }
                    label="Min. Pendidikan"
                    value={recruitmentInfo.minEducation}
                  />
                )}
                {recruitmentInfo.minExperience && (
                  <InfoRow
                    icon={
                      <Calendar
                        weight="BoldDuotone"
                        className="h-4 w-4 text-primary"
                      />
                    }
                    label="Min. Pengalaman"
                    value={recruitmentInfo.minExperience}
                  />
                )}
              </div>

              {recruitmentInfo.jobDescriptions.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 flex items-center gap-1.5">
                    <ClipboardList
                      weight="BoldDuotone"
                      className="h-4 w-4 text-primary"
                    />
                    <p className="text-sm font-medium text-foreground">
                      Deskripsi Pekerjaan
                    </p>
                  </div>
                  <ul className="space-y-1.5 pl-2">
                    {recruitmentInfo.jobDescriptions.map((desc, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
                        {desc}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {recruitmentInfo.isWalkinInterview && (
                <div className="mt-4">
                  <Badge variant="secondary" className="rounded-full text-xs">
                    Walk-in Interview
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Candidate form card */}
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-6">
            <h2 className="mb-5 font-heading text-lg font-semibold text-foreground">
              Data Diri Pelamar
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Full name */}
              <FormField
                id="fullName"
                label="Nama Lengkap"
                required
                icon={
                  <UserCircle
                    weight="BoldDuotone"
                    className="h-4 w-4 text-muted-foreground"
                  />
                }
              >
                <Input
                  id="fullName"
                  type="text"
                  value={form.fullName}
                  onChange={(e) => updateForm("fullName", e.target.value)}
                  placeholder="Masukkan nama lengkap Anda"
                  className="rounded-xl"
                  disabled={submitting}
                  required
                />
              </FormField>

              {/* Email */}
              <FormField
                id="email"
                label="Email"
                required
                icon={
                  <Letter
                    weight="BoldDuotone"
                    className="h-4 w-4 text-muted-foreground"
                  />
                }
              >
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => updateForm("email", e.target.value)}
                  placeholder="contoh@email.com"
                  className="rounded-xl"
                  disabled={submitting}
                  required
                />
              </FormField>

              {/* Phone */}
              <FormField
                id="phoneNumber"
                label="Nomor Telepon"
                required
                icon={
                  <Phone
                    weight="BoldDuotone"
                    className="h-4 w-4 text-muted-foreground"
                  />
                }
              >
                <Input
                  id="phoneNumber"
                  type="tel"
                  value={form.phoneNumber}
                  onChange={(e) => updateForm("phoneNumber", e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  className="rounded-xl"
                  disabled={submitting}
                  required
                />
              </FormField>

              {/* Address */}
              <FormField
                id="address"
                label="Alamat"
                icon={
                  <MapPoint
                    weight="BoldDuotone"
                    className="h-4 w-4 text-muted-foreground"
                  />
                }
              >
                <Textarea
                  id="address"
                  value={form.address}
                  onChange={(e) => updateForm("address", e.target.value)}
                  placeholder="Alamat lengkap Anda"
                  className="rounded-xl resize-none"
                  rows={3}
                  disabled={submitting}
                />
              </FormField>

              {/* Birth place + birth date (2 columns on sm+) */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <FormField
                  id="birthPlace"
                  label="Tempat Lahir"
                  icon={
                    <MapPoint
                      weight="BoldDuotone"
                      className="h-4 w-4 text-muted-foreground"
                    />
                  }
                >
                  <Input
                    id="birthPlace"
                    type="text"
                    value={form.birthPlace}
                    onChange={(e) => updateForm("birthPlace", e.target.value)}
                    placeholder="Kota kelahiran"
                    className="rounded-xl"
                    disabled={submitting}
                  />
                </FormField>

                <FormField
                  id="birthDate"
                  label="Tanggal Lahir"
                  icon={
                    <Calendar
                      weight="BoldDuotone"
                      className="h-4 w-4 text-muted-foreground"
                    />
                  }
                >
                  <Input
                    id="birthDate"
                    type="date"
                    value={form.birthDate}
                    onChange={(e) => updateForm("birthDate", e.target.value)}
                    className="rounded-xl"
                    disabled={submitting}
                  />
                </FormField>
              </div>

              {/* Education + Major (2 columns on sm+) */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <FormField
                  id="lastEducation"
                  label="Pendidikan Terakhir"
                  icon={
                    <Diploma
                      weight="BoldDuotone"
                      className="h-4 w-4 text-muted-foreground"
                    />
                  }
                >
                  <Select
                    value={form.lastEducation}
                    onValueChange={(v) => updateForm("lastEducation", v)}
                    disabled={submitting}
                  >
                    <SelectTrigger id="lastEducation" className="rounded-xl">
                      <SelectValue placeholder="Pilih pendidikan" />
                    </SelectTrigger>
                    <SelectContent>
                      {EDUCATION_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField
                  id="major"
                  label="Jurusan"
                  icon={
                    <Diploma
                      weight="BoldDuotone"
                      className="h-4 w-4 text-muted-foreground"
                    />
                  }
                >
                  <Input
                    id="major"
                    type="text"
                    value={form.major}
                    onChange={(e) => updateForm("major", e.target.value)}
                    placeholder="Contoh: Manajemen"
                    className="rounded-xl"
                    disabled={submitting}
                  />
                </FormField>
              </div>

              {/* Work experience years */}
              <FormField
                id="workExperienceYears"
                label="Pengalaman Kerja (tahun)"
                icon={
                  <Suitcase
                    weight="BoldDuotone"
                    className="h-4 w-4 text-muted-foreground"
                  />
                }
              >
                <Input
                  id="workExperienceYears"
                  type="number"
                  min={0}
                  value={form.workExperienceYears}
                  onChange={(e) =>
                    updateForm("workExperienceYears", e.target.value)
                  }
                  placeholder="0"
                  className="rounded-xl"
                  disabled={submitting}
                />
              </FormField>

              {/* Work history */}
              <FormField
                id="workHistory"
                label="Riwayat Pekerjaan"
                icon={
                  <Suitcase
                    weight="BoldDuotone"
                    className="h-4 w-4 text-muted-foreground"
                  />
                }
              >
                <Textarea
                  id="workHistory"
                  value={form.workHistory}
                  onChange={(e) => updateForm("workHistory", e.target.value)}
                  placeholder="Tuliskan pengalaman kerja sebelumnya (nama perusahaan, posisi, durasi)"
                  className="rounded-xl resize-none"
                  rows={4}
                  disabled={submitting}
                />
              </FormField>

              {/* Photo upload */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Camera
                    weight="BoldDuotone"
                    className="h-4 w-4 text-muted-foreground"
                  />
                  <Label className="text-sm font-medium text-foreground">
                    Foto Diri
                  </Label>
                </div>
                <div
                  className="cursor-pointer rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center transition-colors hover:bg-muted/50"
                  onClick={() => photoInputRef.current?.click()}
                >
                  {photoPreview ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-border">
                        <Image
                          src={photoPreview}
                          alt="Preview foto"
                          fill
                          className="object-cover"
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {photoFile?.name}
                      </p>
                      <p className="text-xs text-primary">Klik untuk ganti</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-2">
                      <Camera
                        weight="BoldDuotone"
                        className="h-8 w-8 text-muted-foreground"
                      />
                      <p className="text-sm text-muted-foreground">
                        Klik untuk upload foto
                      </p>
                      <p className="text-xs text-muted-foreground">
                        JPG, PNG, atau WebP — maks. 5MB
                      </p>
                    </div>
                  )}
                </div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={submitting}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setPhotoFile(file);
                    if (file) {
                      const url = URL.createObjectURL(file);
                      setPhotoPreview(url);
                    } else {
                      setPhotoPreview(null);
                    }
                  }}
                />
              </div>

              {/* CV upload */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <File
                    weight="BoldDuotone"
                    className="h-4 w-4 text-muted-foreground"
                  />
                  <Label className="text-sm font-medium text-foreground">
                    Upload CV / Resume
                  </Label>
                </div>
                <div
                  className="cursor-pointer rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center transition-colors hover:bg-muted/50"
                  onClick={() => cvInputRef.current?.click()}
                >
                  {cvFile ? (
                    <div className="flex flex-col items-center gap-2 py-1">
                      <File
                        weight="BoldDuotone"
                        className="h-8 w-8 text-primary"
                      />
                      <p className="text-sm font-medium text-foreground">
                        {cvFile.name}
                      </p>
                      <p className="text-xs text-primary">Klik untuk ganti</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-2">
                      <File
                        weight="BoldDuotone"
                        className="h-8 w-8 text-muted-foreground"
                      />
                      <p className="text-sm text-muted-foreground">
                        Klik untuk upload CV
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Format PDF — maks. 10MB
                      </p>
                    </div>
                  )}
                </div>
                <input
                  ref={cvInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  disabled={submitting}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setCvFile(file);
                  }}
                />
              </div>

              {/* Submit */}
              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full rounded-full"
                  disabled={submitting}
                >
                  {submitting ? "Mengirim Lamaran..." : "Kirim Lamaran"}
                </Button>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Pastikan semua data yang diisi sudah benar sebelum mengirim.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Small helper components ──────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

function FormField({
  id,
  label,
  required,
  icon,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        {icon}
        <Label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
      </div>
      {children}
    </div>
  );
}

// ─── Page export (Suspense boundary for useSearchParams) ──────────────────────

export default function RecruitmentFormPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted-foreground">Memuat...</p>
        </div>
      }
    >
      <RecruitmentFormContent />
    </Suspense>
  );
}
