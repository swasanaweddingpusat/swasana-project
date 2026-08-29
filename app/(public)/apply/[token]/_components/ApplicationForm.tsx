"use client";

import { useRef, useState } from "react";
import { DocumentText } from "@solar-icons/react";

type PostingInfo = {
  title: string;
  companyName: string | null;
  department: string | null;
  position: string | null;
  location: string | null;
  interviewDate: string | null;
  quota: number | null;
  formToken: string;
};

const RELIGION_OPTIONS = ["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Konghucu"];

export function ApplicationForm({ token }: { token: string }) {
  const [step, setStep] = useState<"code" | "form" | "done">("code");
  const [accessCode, setAccessCode] = useState("");
  const [posting, setPosting] = useState<PostingInfo | null>(null);
  const [notAvailable, setNotAvailable] = useState(false);
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const religionRef = useRef<HTMLSelectElement>(null);
  const expectedSalaryRef = useRef<HTMLInputElement>(null);
  const cvRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const ktpRef = useRef<HTMLInputElement>(null);

  async function handleValidate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accessCode.trim()) { setError("Kode akses wajib diisi."); return; }

    setValidating(true);
    try {
      const res = await fetch(`/api/apply/${token}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: accessCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 404) { setNotAvailable(true); return; }
        setError(data.error ?? "Gagal validasi.");
        return;
      }
      setPosting(data as PostingInfo);
      setStep("form");
    } catch {
      setError("Terjadi kesalahan. Periksa koneksi internet Anda.");
    } finally {
      setValidating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fullName = fullNameRef.current?.value.trim() ?? "";
    const email = emailRef.current?.value.trim() ?? "";
    const religion = religionRef.current?.value ?? "";
    const expectedSalary = expectedSalaryRef.current?.value.trim() ?? "";
    if (!fullName) { setError("Nama lengkap wajib diisi."); return; }
    if (!email) { setError("Email wajib diisi."); return; }
    if (!religion) { setError("Agama wajib dipilih."); return; }
    if (!expectedSalary) { setError("Gaji yang diharapkan wajib diisi."); return; }
    if (!cvRef.current?.files?.[0]) { setError("CV wajib diunggah."); return; }
    if (!photoRef.current?.files?.[0]) { setError("Foto pelamar wajib diunggah."); return; }
    if (!ktpRef.current?.files?.[0]) { setError("Foto KTP wajib diunggah."); return; }
    if (!posting?.formToken) { setError("Sesi form tidak valid. Silakan muat ulang halaman."); return; }

    const fd = new FormData();
    fd.append("formToken", posting.formToken);
    fd.append("fullName", fullName);
    fd.append("email", email);
    if (phoneRef.current?.value.trim()) fd.append("phoneNumber", phoneRef.current.value.trim());
    fd.append("religion", religion);
    fd.append("expectedSalary", expectedSalary);
    fd.append("cv", cvRef.current.files[0]);
    fd.append("photo", photoRef.current.files[0]);
    fd.append("ktpPhoto", ktpRef.current.files[0]);

    setSubmitting(true);
    try {
      const res = await fetch(`/api/apply/${token}`, { method: "POST", body: fd });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (json.success) {
        setStep("done");
      } else {
        setError(json.error ?? "Terjadi kesalahan. Silakan coba lagi.");
      }
    } catch {
      setError("Gagal mengirim lamaran. Periksa koneksi internet Anda.");
    } finally {
      setSubmitting(false);
    }
  }

  if (notAvailable) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <p className="text-lg font-heading font-semibold text-foreground">Lowongan Tidak Tersedia</p>
          <p className="mt-2 text-sm text-muted-foreground">Lowongan ini sudah ditutup atau tidak ditemukan.</p>
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary text-2xl">✓</div>
          <p className="text-lg font-heading font-semibold text-foreground">Lamaran Terkirim!</p>
          <p className="mt-2 text-sm text-muted-foreground">Terima kasih telah melamar. Tim kami akan menghubungi Anda jika memenuhi kualifikasi.</p>
        </div>
      </div>
    );
  }

  if (step === "code") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-5">
          <div className="text-center space-y-1">
            <DocumentText weight="BoldDuotone" className="h-10 w-10 text-primary mx-auto" />
            <p className="mt-2 font-logo text-xl font-semibold text-foreground">Swasana</p>
            <h1 className="text-lg font-heading font-semibold text-foreground">Akses Formulir Lamaran</h1>
            <p className="text-sm text-muted-foreground">Masukkan kode akses yang diberikan oleh HR untuk melanjutkan</p>
          </div>
          <form onSubmit={handleValidate} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="accessCode">Kode Akses</label>
              <input
                id="accessCode"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                placeholder="Contoh: AB1C2D"
                maxLength={6}
                autoFocus
                autoComplete="off"
                className="h-11 w-full rounded-xl border border-input bg-background px-3 text-center text-lg font-mono tracking-widest outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {error && (
              <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
            )}
            <button
              type="submit"
              disabled={validating || !accessCode.trim()}
              className="w-full rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {validating ? "Memvalidasi..." : "Masuk"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <p className="font-logo text-xl font-semibold text-foreground">Swasana</p>
          <h1 className="mt-4 text-2xl font-heading font-semibold text-foreground">{posting?.title}</h1>
          <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {posting?.companyName && <span>{posting.companyName}</span>}
            {posting?.department && <span>{posting.department}</span>}
            {posting?.position && <span>{posting.position}</span>}
            {posting?.location && <span>{posting.location}</span>}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
          <p className="text-sm font-semibold text-foreground border-b border-border pb-2">Data Pelamar</p>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="fullName">
              Nama Lengkap <span className="text-destructive">*</span>
            </label>
            <input
              ref={fullNameRef}
              id="fullName"
              type="text"
              required
              placeholder="Nama sesuai KTP"
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="email">
              Email <span className="text-destructive">*</span>
            </label>
            <input
              ref={emailRef}
              id="email"
              type="email"
              required
              placeholder="nama@email.com"
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="phone">No. HP</label>
            <input
              ref={phoneRef}
              id="phone"
              type="tel"
              placeholder="08xxxxxxxxxx"
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="religion">
              Agama <span className="text-destructive">*</span>
            </label>
            <select
              ref={religionRef}
              id="religion"
              required
              defaultValue=""
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="" disabled>Pilih agama</option>
              {RELIGION_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="expectedSalary">
              Gaji yang Diharapkan <span className="text-destructive">*</span>
            </label>
            <p className="text-xs text-muted-foreground">Dalam Rupiah, tanpa titik atau koma (contoh: 5000000)</p>
            <input
              ref={expectedSalaryRef}
              id="expectedSalary"
              type="number"
              required
              min="0"
              step="1"
              placeholder="5000000"
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="cv">
              CV / Resume <span className="text-destructive">*</span>
            </label>
            <p className="text-xs text-muted-foreground">PDF, Word, atau JPG/PNG, maks 5MB</p>
            <input
              ref={cvRef}
              id="cv"
              type="file"
              required
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1 file:text-xs file:font-medium file:text-primary-foreground"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="photo">
              Foto Pelamar <span className="text-destructive">*</span>
            </label>
            <p className="text-xs text-muted-foreground">JPG/PNG, maks 5MB</p>
            <input
              ref={photoRef}
              id="photo"
              type="file"
              required
              accept="image/*"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1 file:text-xs file:font-medium file:text-primary-foreground"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="ktp">
              Foto KTP <span className="text-destructive">*</span>
            </label>
            <p className="text-xs text-muted-foreground">JPG/PNG, maks 5MB</p>
            <input
              ref={ktpRef}
              id="ktp"
              type="file"
              required
              accept="image/*"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1 file:text-xs file:font-medium file:text-primary-foreground"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? "Mengirim..." : "Kirim Lamaran"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">Didukung oleh Swasana HR</p>
      </div>
    </div>
  );
}
