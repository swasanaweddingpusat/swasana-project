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
import { toast } from "sonner";
import {
  UserCircle,
  Letter,
  Phone,
  MapPoint,
  Calendar,
  Diploma,
  Camera,
  File,
  CheckCircle,
  LockKeyhole,
  Buildings,
  Suitcase,
  Heart,
  UsersGroupTwoRounded,
  Shield,
  Card as CardIcon,
  Wallet,
} from "@solar-icons/react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface OnboardingInfo {
  name: string;
}

interface VenueOption {
  id: string;
  name: string;
}

interface OnboardingFormState {
  // Job info
  divisi: string;
  jabatan: string;
  venueId: string;
  joinDate: string;
  // Personal info
  fullName: string;
  nickName: string;
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

// ─── Constants ───────────────────────────────────────────────────────────────

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

const MARITAL_STATUS_OPTIONS = [
  { value: "single", label: "Belum Menikah" },
  { value: "married", label: "Menikah" },
  { value: "divorced_alive", label: "Janda" },
  { value: "divorced_dead", label: "Duda" },
];

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

// ─── Inner content (uses useSearchParams — must be inside Suspense) ──────────

function OnboardingFormContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [step, setStep] = useState<"code" | "form" | "done">("code");
  const [accessCode, setAccessCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState("");

  const [onboardingInfo, setOnboardingInfo] = useState<OnboardingInfo | null>(null);
  const [venues, setVenues] = useState<VenueOption[]>([]);

  const [form, setForm] = useState<OnboardingFormState>({
    divisi: "",
    jabatan: "",
    venueId: "",
    joinDate: "",
    fullName: "",
    nickName: "",
    placeOfBirth: "",
    dateOfBirth: "",
    phoneNumber: "",
    email: "",
    maritalStatus: "",
    ktpAddress: "",
    currentAddress: "",
    motherName: "",
    numberOfChildren: "0",
    lastEducation: "",
    emergencyContactName: "",
    emergencyContactRel: "",
    emergencyContactPhone: "",
    bankName: "",
    bankAccountNumber: "",
  });

  // File states
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [ktpFile, setKtpFile] = useState<File | null>(null);
  const [kkFile, setKkFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const ktpInputRef = useRef<HTMLInputElement>(null);
  const kkInputRef = useRef<HTMLInputElement>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function updateForm(field: keyof OnboardingFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function uploadFile(
    file: File,
    type: "photo" | "ktp" | "kk"
  ): Promise<string | null> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("token", token);
    fd.append("accessCode", accessCode);
    fd.append("type", type);
    const res = await fetch("/api/onboarding-form/upload", {
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
      const res = await fetch("/api/onboarding-form/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          accessCode: accessCode.trim().toUpperCase(),
        }),
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
        "onboardingInfo" in data
      ) {
        const info = (data as Record<string, unknown>).onboardingInfo as OnboardingInfo;
        const venueList = (data as Record<string, unknown>).venues as VenueOption[];
        setOnboardingInfo(info);
        setVenues(venueList ?? []);
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

    if (!form.divisi) {
      toast.error("Divisi wajib dipilih");
      return;
    }
    if (!form.jabatan) {
      toast.error("Jabatan wajib dipilih");
      return;
    }
    if (!form.venueId) {
      toast.error("Venue wajib dipilih");
      return;
    }
    if (!form.fullName.trim()) {
      toast.error("Nama lengkap wajib diisi");
      return;
    }
    if (!form.nickName.trim()) {
      toast.error("Nama panggilan wajib diisi");
      return;
    }
    if (!form.phoneNumber.trim()) {
      toast.error("Nomor HP wajib diisi");
      return;
    }
    if (!ktpFile) {
      toast.error("KTP wajib diupload");
      return;
    }
    if (!kkFile) {
      toast.error("Kartu Keluarga wajib diupload");
      return;
    }

    setSubmitting(true);
    try {
      let photoKey: string | null = null;
      let ktpKey: string | null = null;
      let kkKey: string | null = null;

      if (photoFile) {
        photoKey = await uploadFile(photoFile, "photo");
        if (photoKey === null) {
          setSubmitting(false);
          return;
        }
      }

      ktpKey = await uploadFile(ktpFile, "ktp");
      if (ktpKey === null) {
        setSubmitting(false);
        return;
      }

      kkKey = await uploadFile(kkFile, "kk");
      if (kkKey === null) {
        setSubmitting(false);
        return;
      }

      const payload = {
        token,
        accessCode: accessCode.trim().toUpperCase(),
        divisi: form.divisi,
        jabatan: form.jabatan,
        venueId: form.venueId,
        joinDate: form.joinDate,
        fullName: form.fullName.trim(),
        nickName: form.nickName.trim(),
        placeOfBirth: form.placeOfBirth.trim(),
        dateOfBirth: form.dateOfBirth,
        phoneNumber: form.phoneNumber.trim(),
        email: form.email.trim(),
        maritalStatus: form.maritalStatus,
        ktpAddress: form.ktpAddress.trim(),
        currentAddress: form.currentAddress.trim(),
        motherName: form.motherName.trim(),
        numberOfChildren: form.numberOfChildren
          ? parseInt(form.numberOfChildren, 10)
          : 0,
        lastEducation: form.lastEducation,
        emergencyContactName: form.emergencyContactName.trim(),
        emergencyContactRel: form.emergencyContactRel.trim(),
        emergencyContactPhone: form.emergencyContactPhone.trim(),
        bankName: form.bankName.trim(),
        bankAccountNumber: form.bankAccountNumber.trim(),
        photoUrl: photoKey,
        ktpFileUrl: ktpKey,
        kkFileUrl: kkKey,
      };

      const res = await fetch("/api/onboarding-form/submit", {
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
            : "Gagal mengirim data onboarding";
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
              Sistem Onboarding Karyawan
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
                  Form Data Karyawan Baru
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
              Data Berhasil Dikirim!
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Terima kasih telah melengkapi data onboarding. Tim HR akan
              meninjau data Anda dan mengirimkan undangan untuk mengakses
              sistem.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Render: form step ────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div>
          <p className="font-logo text-lg font-semibold text-foreground">
            Swasana Wedding
          </p>
          <h1 className="mt-1 font-heading text-2xl font-bold text-foreground">
            Form Data Karyawan Baru
          </h1>
          {onboardingInfo && (
            <p className="mt-1 text-sm text-muted-foreground">
              {onboardingInfo.name} — Silakan lengkapi data diri Anda di bawah ini dengan benar.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ── Informasi Pekerjaan ──────────────────────────────────────── */}
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <h2 className="mb-5 font-heading text-lg font-semibold text-foreground">
                Informasi Pekerjaan
              </h2>

              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  {/* Divisi */}
                  <FormField
                    id="divisi"
                    label="Divisi"
                    required
                    icon={
                      <Buildings
                        weight="BoldDuotone"
                        className="h-4 w-4 text-muted-foreground"
                      />
                    }
                  >
                    <Select
                      value={form.divisi}
                      onValueChange={(v) => updateForm("divisi", v)}
                      disabled={submitting}
                    >
                      <SelectTrigger id="divisi" className="rounded-xl">
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
                  </FormField>

                  {/* Jabatan */}
                  <FormField
                    id="jabatan"
                    label="Jabatan"
                    required
                    icon={
                      <Suitcase
                        weight="BoldDuotone"
                        className="h-4 w-4 text-muted-foreground"
                      />
                    }
                  >
                    <Select
                      value={form.jabatan}
                      onValueChange={(v) => updateForm("jabatan", v)}
                      disabled={submitting}
                    >
                      <SelectTrigger id="jabatan" className="rounded-xl">
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
                  </FormField>
                </div>

                {/* Venue */}
                <FormField
                  id="venueId"
                  label="Venue"
                  required
                  icon={
                    <Buildings
                      weight="BoldDuotone"
                      className="h-4 w-4 text-muted-foreground"
                    />
                  }
                >
                  <Select
                    value={form.venueId}
                    onValueChange={(v) => updateForm("venueId", v)}
                    disabled={submitting}
                  >
                    <SelectTrigger id="venueId" className="rounded-xl">
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
                </FormField>

                {/* Tanggal Bergabung */}
                <FormField
                  id="joinDate"
                  label="Tanggal Bergabung"
                  required
                  icon={
                    <Calendar
                      weight="BoldDuotone"
                      className="h-4 w-4 text-muted-foreground"
                    />
                  }
                >
                  <Input
                    id="joinDate"
                    type="date"
                    value={form.joinDate}
                    onChange={(e) => updateForm("joinDate", e.target.value)}
                    className="rounded-xl"
                    disabled={submitting}
                  />
                </FormField>
              </div>
            </CardContent>
          </Card>

          {/* ── Data Pribadi ─────────────────────────────────────────────── */}
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <div className="mb-5 flex items-center gap-2">
                <UserCircle
                  weight="BoldDuotone"
                  className="h-5 w-5 text-primary"
                />
                <h2 className="font-heading text-lg font-semibold text-foreground">
                  Data Pribadi
                </h2>
              </div>

              <div className="space-y-5">
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
                    placeholder="Masukkan nama lengkap sesuai KTP"
                    className="rounded-xl"
                    disabled={submitting}
                    required
                  />
                </FormField>

                {/* Nick name */}
                <FormField
                  id="nickName"
                  label="Nama Panggilan"
                  required
                  icon={
                    <UserCircle
                      weight="BoldDuotone"
                      className="h-4 w-4 text-muted-foreground"
                    />
                  }
                >
                  <Input
                    id="nickName"
                    type="text"
                    value={form.nickName}
                    onChange={(e) => updateForm("nickName", e.target.value)}
                    placeholder="Nama yang biasa dipanggil"
                    className="rounded-xl"
                    disabled={submitting}
                    required
                  />
                </FormField>

                {/* Place + Date of birth (2 columns) */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <FormField
                    id="placeOfBirth"
                    label="Tempat Lahir"
                    required
                    icon={
                      <MapPoint
                        weight="BoldDuotone"
                        className="h-4 w-4 text-muted-foreground"
                      />
                    }
                  >
                    <Input
                      id="placeOfBirth"
                      type="text"
                      value={form.placeOfBirth}
                      onChange={(e) =>
                        updateForm("placeOfBirth", e.target.value)
                      }
                      placeholder="Kota kelahiran"
                      className="rounded-xl"
                      disabled={submitting}
                    />
                  </FormField>

                  <FormField
                    id="dateOfBirth"
                    label="Tanggal Lahir"
                    required
                    icon={
                      <Calendar
                        weight="BoldDuotone"
                        className="h-4 w-4 text-muted-foreground"
                      />
                    }
                  >
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={form.dateOfBirth}
                      onChange={(e) =>
                        updateForm("dateOfBirth", e.target.value)
                      }
                      className="rounded-xl"
                      disabled={submitting}
                    />
                  </FormField>
                </div>

                {/* Phone */}
                <FormField
                  id="phoneNumber"
                  label="Nomor HP"
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
                  />
                </FormField>

                {/* Marital status */}
                <FormField
                  id="maritalStatus"
                  label="Status Pernikahan"
                  required
                  icon={
                    <Heart
                      weight="BoldDuotone"
                      className="h-4 w-4 text-muted-foreground"
                    />
                  }
                >
                  <Select
                    value={form.maritalStatus}
                    onValueChange={(v) => updateForm("maritalStatus", v)}
                    disabled={submitting}
                  >
                    <SelectTrigger id="maritalStatus" className="rounded-xl">
                      <SelectValue placeholder="Pilih status pernikahan" />
                    </SelectTrigger>
                    <SelectContent>
                      {MARITAL_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                {/* KTP address */}
                <FormField
                  id="ktpAddress"
                  label="Alamat KTP"
                  required
                  icon={
                    <MapPoint
                      weight="BoldDuotone"
                      className="h-4 w-4 text-muted-foreground"
                    />
                  }
                >
                  <Textarea
                    id="ktpAddress"
                    value={form.ktpAddress}
                    onChange={(e) => updateForm("ktpAddress", e.target.value)}
                    placeholder="Alamat sesuai KTP"
                    className="resize-none rounded-xl"
                    rows={3}
                    disabled={submitting}
                  />
                </FormField>

                {/* Current address */}
                <FormField
                  id="currentAddress"
                  label="Alamat Domisili"
                  required
                  icon={
                    <MapPoint
                      weight="BoldDuotone"
                      className="h-4 w-4 text-muted-foreground"
                    />
                  }
                >
                  <Textarea
                    id="currentAddress"
                    value={form.currentAddress}
                    onChange={(e) =>
                      updateForm("currentAddress", e.target.value)
                    }
                    placeholder="Alamat tempat tinggal saat ini (kosongkan jika sama dengan KTP)"
                    className="resize-none rounded-xl"
                    rows={3}
                    disabled={submitting}
                  />
                </FormField>

                {/* Mother name */}
                <FormField
                  id="motherName"
                  label="Nama Ibu Kandung"
                  required
                  icon={
                    <UserCircle
                      weight="BoldDuotone"
                      className="h-4 w-4 text-muted-foreground"
                    />
                  }
                >
                  <Input
                    id="motherName"
                    type="text"
                    value={form.motherName}
                    onChange={(e) => updateForm("motherName", e.target.value)}
                    placeholder="Nama ibu kandung"
                    className="rounded-xl"
                    disabled={submitting}
                  />
                </FormField>

                {/* Number of children + Last education (2 columns) */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <FormField
                    id="numberOfChildren"
                    label="Jumlah Anak"
                    icon={
                      <UsersGroupTwoRounded
                        weight="BoldDuotone"
                        className="h-4 w-4 text-muted-foreground"
                      />
                    }
                  >
                    <Input
                      id="numberOfChildren"
                      type="number"
                      min={0}
                      value={form.numberOfChildren}
                      onChange={(e) =>
                        updateForm("numberOfChildren", e.target.value)
                      }
                      placeholder="0"
                      className="rounded-xl"
                      disabled={submitting}
                    />
                  </FormField>

                  <FormField
                    id="lastEducation"
                    label="Pendidikan Terakhir"
                    required
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
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Kontak Darurat ───────────────────────────────────────────── */}
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <div className="mb-5 flex items-center gap-2">
                <Shield
                  weight="BoldDuotone"
                  className="h-5 w-5 text-primary"
                />
                <h2 className="font-heading text-lg font-semibold text-foreground">
                  Kontak Darurat
                </h2>
              </div>

              <div className="space-y-5">
                <FormField
                  id="emergencyContactName"
                  label="Nama"
                  required
                  icon={
                    <UserCircle
                      weight="BoldDuotone"
                      className="h-4 w-4 text-muted-foreground"
                    />
                  }
                >
                  <Input
                    id="emergencyContactName"
                    type="text"
                    value={form.emergencyContactName}
                    onChange={(e) =>
                      updateForm("emergencyContactName", e.target.value)
                    }
                    placeholder="Nama kontak darurat"
                    className="rounded-xl"
                    disabled={submitting}
                  />
                </FormField>

                <FormField
                  id="emergencyContactRel"
                  label="Hubungan"
                  required
                  icon={
                    <Heart
                      weight="BoldDuotone"
                      className="h-4 w-4 text-muted-foreground"
                    />
                  }
                >
                  <Input
                    id="emergencyContactRel"
                    type="text"
                    value={form.emergencyContactRel}
                    onChange={(e) =>
                      updateForm("emergencyContactRel", e.target.value)
                    }
                    placeholder="Contoh: Orang Tua, Suami/Istri"
                    className="rounded-xl"
                    disabled={submitting}
                  />
                </FormField>

                <FormField
                  id="emergencyContactPhone"
                  label="Nomor HP"
                  required
                  icon={
                    <Phone
                      weight="BoldDuotone"
                      className="h-4 w-4 text-muted-foreground"
                    />
                  }
                >
                  <Input
                    id="emergencyContactPhone"
                    type="tel"
                    value={form.emergencyContactPhone}
                    onChange={(e) =>
                      updateForm("emergencyContactPhone", e.target.value)
                    }
                    placeholder="08xxxxxxxxxx"
                    className="rounded-xl"
                    disabled={submitting}
                  />
                </FormField>
              </div>
            </CardContent>
          </Card>

          {/* ── Rekening ─────────────────────────────────────────────────── */}
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <div className="mb-5 flex items-center gap-2">
                <Wallet
                  weight="BoldDuotone"
                  className="h-5 w-5 text-primary"
                />
                <h2 className="font-heading text-lg font-semibold text-foreground">
                  Rekening Bank
                </h2>
              </div>

              <div className="space-y-5">
                <FormField
                  id="bankName"
                  label="Nama Bank"
                  required
                  icon={
                    <Buildings
                      weight="BoldDuotone"
                      className="h-4 w-4 text-muted-foreground"
                    />
                  }
                >
                  <Input
                    id="bankName"
                    type="text"
                    value={form.bankName}
                    onChange={(e) => updateForm("bankName", e.target.value)}
                    placeholder="Contoh: BCA, BRI, Mandiri"
                    className="rounded-xl"
                    disabled={submitting}
                  />
                </FormField>

                <FormField
                  id="bankAccountNumber"
                  label="Nomor Rekening"
                  required
                  icon={
                    <CardIcon
                      weight="BoldDuotone"
                      className="h-4 w-4 text-muted-foreground"
                    />
                  }
                >
                  <Input
                    id="bankAccountNumber"
                    type="text"
                    value={form.bankAccountNumber}
                    onChange={(e) =>
                      updateForm("bankAccountNumber", e.target.value)
                    }
                    placeholder="Nomor rekening"
                    className="rounded-xl"
                    disabled={submitting}
                  />
                </FormField>
              </div>
            </CardContent>
          </Card>

          {/* ── Upload Dokumen ───────────────────────────────────────────── */}
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <div className="mb-5 flex items-center gap-2">
                <File weight="BoldDuotone" className="h-5 w-5 text-primary" />
                <h2 className="font-heading text-lg font-semibold text-foreground">
                  Upload Dokumen
                </h2>
              </div>

              <div className="space-y-6">
                {/* Photo upload (optional) */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Camera
                      weight="BoldDuotone"
                      className="h-4 w-4 text-muted-foreground"
                    />
                    <Label className="text-sm font-medium text-foreground">
                      Foto Diri
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        (opsional)
                      </span>
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
                          Klik untuk upload foto diri
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

                {/* KTP upload (required) */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <File
                      weight="BoldDuotone"
                      className="h-4 w-4 text-muted-foreground"
                    />
                    <Label className="text-sm font-medium text-foreground">
                      KTP
                      <span className="ml-0.5 text-destructive">*</span>
                    </Label>
                  </div>
                  <div
                    className="cursor-pointer rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center transition-colors hover:bg-muted/50"
                    onClick={() => ktpInputRef.current?.click()}
                  >
                    {ktpFile ? (
                      <div className="flex flex-col items-center gap-2 py-1">
                        <File
                          weight="BoldDuotone"
                          className="h-8 w-8 text-primary"
                        />
                        <p className="text-sm font-medium text-foreground">
                          {ktpFile.name}
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
                          Klik untuk upload KTP
                        </p>
                        <p className="text-xs text-muted-foreground">
                          JPG, PNG, atau PDF — maks. 10MB
                        </p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={ktpInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    disabled={submitting}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setKtpFile(file);
                    }}
                  />
                </div>

                {/* KK upload (required) */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <File
                      weight="BoldDuotone"
                      className="h-4 w-4 text-muted-foreground"
                    />
                    <Label className="text-sm font-medium text-foreground">
                      Kartu Keluarga (KK)
                      <span className="ml-0.5 text-destructive">*</span>
                    </Label>
                  </div>
                  <div
                    className="cursor-pointer rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center transition-colors hover:bg-muted/50"
                    onClick={() => kkInputRef.current?.click()}
                  >
                    {kkFile ? (
                      <div className="flex flex-col items-center gap-2 py-1">
                        <File
                          weight="BoldDuotone"
                          className="h-8 w-8 text-primary"
                        />
                        <p className="text-sm font-medium text-foreground">
                          {kkFile.name}
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
                          Klik untuk upload Kartu Keluarga
                        </p>
                        <p className="text-xs text-muted-foreground">
                          JPG, PNG, atau PDF — maks. 10MB
                        </p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={kkInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    disabled={submitting}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setKkFile(file);
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="pb-8">
            <Button
              type="submit"
              className="w-full rounded-full"
              disabled={submitting}
            >
              {submitting ? "Mengirim Data..." : "Kirim Data Onboarding"}
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Pastikan semua data yang diisi sudah benar sebelum mengirim.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Small helper components ──────────────────────────────────────────────────

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

export default function OnboardingFormPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted-foreground">Memuat...</p>
        </div>
      }
    >
      <OnboardingFormContent />
    </Suspense>
  );
}
