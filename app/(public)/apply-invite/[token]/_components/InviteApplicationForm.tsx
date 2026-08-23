"use client";

import { useRef, useState } from "react";
import { UserPlus } from "@solar-icons/react";

type CandidateInfo = {
  fullName: string;
  email: string;
  phoneNumber: string | null;
  religion: string | null;
  expectedSalary: string | null;
};

type JobPostingInfo = {
  title: string;
  companyName: string | null;
};

const RELIGION_OPTIONS = ["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Konghucu"];

export function InviteApplicationForm({ token }: { token: string }) {
  const [step, setStep] = useState<"code" | "form" | "done" | "locked">("code");
  const [accessCode, setAccessCode] = useState("");
  const [candidate, setCandidate] = useState<CandidateInfo | null>(null);
  const [jobPosting, setJobPosting] = useState<JobPostingInfo | null>(null);
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const res = await fetch(`/api/apply-invite/${token}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode: accessCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Gagal validasi."); return; }
      if (data.locked) { setStep("locked"); return; }
      setCandidate(data.candidate);
      setJobPosting(data.jobPosting);
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

    const religion = religionRef.current?.value ?? "";
    const expectedSalary = expectedSalaryRef.current?.value.trim() ?? "";
    if (!religion) { setError("Agama wajib dipilih."); return; }
    if (!expectedSalary) { setError("Gaji yang diharapkan wajib diisi."); return; }
    if (!cvRef.current?.files?.[0]) { setError("CV wajib diunggah."); return; }
    if (!photoRef.current?.files?.[0]) { setError("Foto pelamar wajib diunggah."); return; }
    if (!ktpRef.current?.files?.[0]) { setError("Foto KTP wajib diunggah."); return; }

    const fd = new FormData();
    fd.append("accessCode", accessCode.trim());
    if (phoneRef.current?.value.trim()) fd.append("phoneNumber", phoneRef.current.value.trim());
    fd.append("religion", religion);
    fd.append("expectedSalary", expectedSalary);
    fd.append("cv", cvRef.current.files[0]);
    fd.append("photo", photoRef.current.files[0]);
    fd.append("ktpPhoto", ktpRef.current.files[0]);

    setSubmitting(true);
    try {
      const res = await fetch(`/api/apply-invite/${token}/submit`, { method: "POST", body: fd });
      const json = (await res.json()) as { success: boolean; locked?: boolean; error?: string };
      if (json.success) {
        setStep("done");
      } else if (json.locked) {
        setStep("locked");
      } else {
        setError(json.error ?? "Terjadi kesalahan. Silakan coba lagi.");
      }
    } catch {
      setError("Gagal mengirim data. Periksa koneksi internet Anda.");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "locked") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <p className="text-lg font-heading font-semibold text-foreground">Link Sudah Tidak Dapat Diakses</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Link ini sudah pernah digunakan untuk melengkapi data. Silahkan hubungi admin untuk tindak lanjut.
          </p>
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary text-2xl">✓</div>
          <p className="text-lg font-heading font-semibold text-foreground">Data Terkirim!</p>
          <p className="mt-2 text-sm text-muted-foreground">Terima kasih telah melengkapi data lamaran Anda. Tim kami akan menghubungi Anda selanjutnya.</p>
        </div>
      </div>
    );
  }

  if (step === "code") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-5">
          <div className="text-center space-y-1">
            <UserPlus weight="BoldDuotone" className="h-10 w-10 text-primary mx-auto" />
            <p className="mt-2 font-logo text-xl font-semibold text-foreground">Swasana</p>
            <h1 className="text-lg font-heading font-semibold text-foreground">Undangan Melengkapi Lamaran</h1>
            <p className="text-sm text-muted-foreground">Masukkan kode akses yang Anda terima untuk melanjutkan</p>
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
        <div className="mb-8 text-center">
          <p className="font-logo text-xl font-semibold text-foreground">Swasana</p>
          <h1 className="mt-4 text-2xl font-heading font-semibold text-foreground">{jobPosting?.title}</h1>
          {jobPosting?.companyName && (
            <p className="mt-2 text-sm text-muted-foreground">{jobPosting.companyName}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
          <p className="text-sm font-semibold text-foreground border-b border-border pb-2">Lengkapi Data Pelamar</p>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Nama Lengkap</label>
            <input
              value={candidate?.fullName ?? ""}
              disabled
              readOnly
              className="h-10 w-full rounded-xl border border-input bg-muted px-3 text-sm text-muted-foreground outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Email</label>
            <input
              value={candidate?.email ?? ""}
              disabled
              readOnly
              className="h-10 w-full rounded-xl border border-input bg-muted px-3 text-sm text-muted-foreground outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="phone">No. HP</label>
            <input
              ref={phoneRef}
              id="phone"
              type="tel"
              defaultValue={candidate?.phoneNumber ?? ""}
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
              defaultValue={candidate?.religion ?? ""}
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
              defaultValue={candidate?.expectedSalary ?? ""}
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
            {submitting ? "Mengirim..." : "Kirim Data"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">Didukung oleh Swasana HR</p>
      </div>
    </div>
  );
}
