"use client";

import { useState } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { toast } from "sonner";
import { AddCircle, TrashBinTrash } from "@solar-icons/react";
import { Drawer } from "@/components/shared/drawer";
import { SignaturePad } from "@/components/shared/signature-pad";
import { useCreateRecruitmentRequest } from "@/hooks/use-recruitment-requests";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useMySignature } from "@/hooks/use-my-signature";
import { useUsers } from "@/hooks/use-users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

interface RecruitmentRequestDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RecruitmentRequestDrawer({
  isOpen,
  onClose,
}: RecruitmentRequestDrawerProps) {
  // Top section
  const [isWalkin, setIsWalkin] = useState(false);
  const [perusahaan, setPerusahaan] = useState("");
  const [tanggalDokumen, setTanggalDokumen] = useState<Date | undefined>(undefined);

  // Section A
  const [divisi, setDivisi] = useState("");
  const [posisi, setPosisi] = useState("");
  const [level, setLevel] = useState("");
  const [gaji, setGaji] = useState("");
  const [kuota, setKuota] = useState("");
  const [lokasiKerja, setLokasiKerja] = useState("");
  const [lokasiInterview, setLokasiInterview] = useState("");
  const [pendampingTraining, setPendampingTraining] = useState("");
  const [tanggalMulai, setTanggalMulai] = useState<Date | undefined>(undefined);

  // Section B
  const [pendidikanMinimal, setPendidikanMinimal] = useState("");
  const [pengalamanMinimal, setPengalamanMinimal] = useState("");
  const [kualifikasiLainnya, setKualifikasiLainnya] = useState("");
  const [deskripsiPekerjaan, setDeskripsiPekerjaan] = useState<string[]>([""]);
  const [catatanTambahan, setCatatanTambahan] = useState<string[]>([""]);
  const [yangMenyetujui1, setYangMenyetujui1] = useState("");
  const [yangMenyetujui2, setYangMenyetujui2] = useState("");

  // Signature
  const [signature, setSignature] = useState<string | null>(null);
  const [useDefaultSig, setUseDefaultSig] = useState(false);

  const { user } = useCurrentUser();
  const { defaultSignature } = useMySignature();
  const { data: usersData } = useUsers(undefined, { limit: 200 });
  const userOptions = usersData?.users
    ?.filter((u) => u.profile?.status === "active")
    .map((u) => ({
      profileId: u.profile!.id,
      label: u.profile?.fullName ?? u.name ?? u.email,
    })) ?? [];

  const [fpkNumber] = useState(() => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yy = String(now.getFullYear()).slice(-3);
    const dd = String(now.getDate()).padStart(2, "0");
    const rand = String(Math.floor(Math.random() * 90) + 10);
    return `FPK-${mm}${yy}${dd}-${rand}`;
  });

  function formatCurrency(value: string): string {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "";
    return new Intl.NumberFormat("id-ID").format(Number(digits));
  }

  function handleGajiBlur() {
    setGaji(formatCurrency(gaji));
  }

  // Deskripsi Pekerjaan handlers
  function addDeskripsi() {
    setDeskripsiPekerjaan((prev) => [...prev, ""]);
  }

  function updateDeskripsi(index: number, value: string) {
    setDeskripsiPekerjaan((prev) =>
      prev.map((item, i) => (i === index ? value : item))
    );
  }

  function removeDeskripsi(index: number) {
    setDeskripsiPekerjaan((prev) => prev.filter((_, i) => i !== index));
  }

  // Catatan Tambahan handlers
  function addCatatan() {
    setCatatanTambahan((prev) => [...prev, ""]);
  }

  function updateCatatan(index: number, value: string) {
    setCatatanTambahan((prev) =>
      prev.map((item, i) => (i === index ? value : item))
    );
  }

  function removeCatatan(index: number) {
    setCatatanTambahan((prev) => prev.filter((_, i) => i !== index));
  }

  const createMutation = useCreateRecruitmentRequest();

  async function handleSubmit() {
    if (!signature) {
      toast.error("Tanda tangan wajib diisi");
      return;
    }

    const salaryDigits = gaji.replace(/\D/g, "");
    const result = await createMutation.mutateAsync({
      isWalkinInterview: isWalkin,
      company: perusahaan || null,
      documentDate: tanggalDokumen ? tanggalDokumen.toISOString() : null,
      level: level || null,
      salary: salaryDigits ? Number(salaryDigits) : null,
      quota: kuota ? Number(kuota) : 1,
      workLocation: lokasiKerja || null,
      interviewLocation: lokasiInterview || null,
      trainingCompanion: pendampingTraining || null,
      startDate: tanggalMulai ? tanggalMulai.toISOString() : null,
      minEducation: pendidikanMinimal || null,
      minExperience: pengalamanMinimal || null,
      otherQualifications: kualifikasiLainnya || null,
      jobDescriptions: deskripsiPekerjaan.filter(Boolean),
      additionalNotes: catatanTambahan.filter(Boolean),
      priority: "medium" as const,
      approver1Id: yangMenyetujui1 || null,
      approver2Id: yangMenyetujui2 || null,
    });

    if (result.success) {
      toast.success("Permintaan rekrutmen berhasil dibuat");
      setIsWalkin(false);
      setPerusahaan("");
      setTanggalDokumen(undefined);
      setDivisi("");
      setPosisi("");
      setLevel("");
      setGaji("");
      setKuota("");
      setLokasiKerja("");
      setLokasiInterview("");
      setPendampingTraining("");
      setTanggalMulai(undefined);
      setPendidikanMinimal("");
      setPengalamanMinimal("");
      setKualifikasiLainnya("");
      setDeskripsiPekerjaan([""]);
      setCatatanTambahan([""]);
      setYangMenyetujui1("");
      setYangMenyetujui2("");
      setSignature(null);
      setUseDefaultSig(false);
      onClose();
      return;
    }

    toast.error(result.error ?? "Gagal membuat permintaan rekrutmen");
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Form Permintaan Karyawan (FPK)"
      maxWidth="sm:max-w-2xl"
    >
      <div className="space-y-6 pb-4">
        {/* Top section */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          {/* Walkin Interview */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="walkin-interview"
              checked={isWalkin}
              onCheckedChange={(checked) => setIsWalkin(checked === true)}
            />
            <Label htmlFor="walkin-interview" className="cursor-pointer">
              Walkin Interview
            </Label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Perusahaan */}
            <div className="space-y-2">
              <Label htmlFor="perusahaan">Perusahaan</Label>
              <Select value={perusahaan} onValueChange={setPerusahaan}>
                <SelectTrigger id="perusahaan" className="rounded-xl w-full">
                  <SelectValue placeholder="Pilih perusahaan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt-swasana-group">PT Swasana Group</SelectItem>
                  <SelectItem value="pt-swasana-pusat">PT Swasana Pusat</SelectItem>
                  <SelectItem value="pt-swasana-cabang">PT Swasana Cabang</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tanggal Dokumen */}
            <div className="space-y-2">
              <Label>Tanggal Dokumen</Label>
              <Popover>
                <PopoverTrigger render={
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start text-left font-normal rounded-xl"
                  >
                    {tanggalDokumen ? (
                      format(tanggalDokumen, "dd MMM yyyy", { locale: id })
                    ) : (
                      <span className="text-muted-foreground">Pilih tanggal</span>
                    )}
                  </Button>
                } />
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={tanggalDokumen}
                    onSelect={setTanggalDokumen}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Nomor FPK */}
          <div className="space-y-2">
            <Label htmlFor="nomor-fpk">Nomor FPK</Label>
            <Input
              id="nomor-fpk"
              value={fpkNumber}
              disabled
              className="rounded-xl bg-muted text-muted-foreground"
            />
          </div>
        </div>

        {/* Section A: PENGAJUAN */}
        <div className="space-y-4">
          <h3 className="text-base font-heading font-semibold text-foreground">
            A. PENGAJUAN
          </h3>
          <Separator />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Divisi */}
            <div className="space-y-2">
              <Label htmlFor="divisi-pengajuan">Divisi</Label>
              <Select value={divisi} onValueChange={setDivisi}>
                <SelectTrigger id="divisi-pengajuan" className="rounded-xl w-full">
                  <SelectValue placeholder="Pilih divisi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="hr">HR</SelectItem>
                  <SelectItem value="operations">Operations</SelectItem>
                  <SelectItem value="it">IT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Posisi */}
            <div className="space-y-2">
              <Label htmlFor="posisi-pengajuan">Posisi</Label>
              <Select value={posisi} onValueChange={setPosisi}>
                <SelectTrigger id="posisi-pengajuan" className="rounded-xl w-full">
                  <SelectValue placeholder="Pilih posisi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="senior-manager">Senior Manager</SelectItem>
                  <SelectItem value="director">Director</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Level */}
            <div className="space-y-2">
              <Label htmlFor="level-pengajuan">Level</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger id="level-pengajuan" className="rounded-xl w-full">
                  <SelectValue placeholder="Pilih level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="junior">Junior</SelectItem>
                  <SelectItem value="mid">Mid</SelectItem>
                  <SelectItem value="senior">Senior</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="executive">Executive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Kuota */}
            <div className="space-y-2">
              <Label htmlFor="kuota">Kuota</Label>
              <Input
                id="kuota"
                type="number"
                min={1}
                value={kuota}
                onChange={(e) => setKuota(e.target.value)}
                className="rounded-xl"
                placeholder="1"
              />
            </div>
          </div>

          {/* Gaji */}
          <div className="space-y-2">
            <Label htmlFor="gaji">Gaji</Label>
            <div className="flex items-center rounded-xl border border-input bg-background overflow-hidden focus-within:ring-1 focus-within:ring-ring">
              <span className="px-3 py-2 text-sm text-muted-foreground border-r border-input shrink-0">
                Rp.
              </span>
              <input
                id="gaji"
                type="text"
                value={gaji}
                onChange={(e) => setGaji(e.target.value)}
                onBlur={handleGajiBlur}
                className="flex-1 px-3 py-2 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Lokasi Kerja */}
            <div className="space-y-2">
              <Label htmlFor="lokasi-kerja">Lokasi Kerja</Label>
              <Select value={lokasiKerja} onValueChange={setLokasiKerja}>
                <SelectTrigger id="lokasi-kerja" className="rounded-xl w-full">
                  <SelectValue placeholder="Pilih lokasi kerja" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="jakarta">Jakarta</SelectItem>
                  <SelectItem value="bandung">Bandung</SelectItem>
                  <SelectItem value="surabaya">Surabaya</SelectItem>
                  <SelectItem value="bali">Bali</SelectItem>
                  <SelectItem value="yogyakarta">Yogyakarta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Lokasi Interview */}
            <div className="space-y-2">
              <Label htmlFor="lokasi-interview">Lokasi Interview</Label>
              <Input
                id="lokasi-interview"
                value={lokasiInterview}
                onChange={(e) => setLokasiInterview(e.target.value)}
                className="rounded-xl"
                placeholder="Cari lokasi interview..."
              />
            </div>

            {/* Pendamping Training */}
            <div className="space-y-2">
              <Label htmlFor="pendamping-training">Pendamping Training</Label>
              <Input
                id="pendamping-training"
                value={pendampingTraining}
                onChange={(e) => setPendampingTraining(e.target.value)}
                className="rounded-xl"
                placeholder="Nama pendamping training"
              />
            </div>

            {/* Tanggal Mulai Bekerja */}
            <div className="space-y-2">
              <Label>Tanggal Mulai Bekerja</Label>
              <Popover>
                <PopoverTrigger render={
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start text-left font-normal rounded-xl"
                  >
                    {tanggalMulai ? (
                      format(tanggalMulai, "dd MMM yyyy", { locale: id })
                    ) : (
                      <span className="text-muted-foreground">Pilih tanggal</span>
                    )}
                  </Button>
                } />
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={tanggalMulai}
                    onSelect={setTanggalMulai}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Section B: KUALIFIKASI */}
        <div className="space-y-4">
          <h3 className="text-base font-heading font-semibold text-foreground">
            B. KUALIFIKASI
          </h3>
          <Separator />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Pendidikan Minimal */}
            <div className="space-y-2">
              <Label htmlFor="pendidikan-minimal">Pendidikan Minimal</Label>
              <Select value={pendidikanMinimal} onValueChange={setPendidikanMinimal}>
                <SelectTrigger id="pendidikan-minimal" className="rounded-xl w-full">
                  <SelectValue placeholder="Pilih pendidikan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sma-smk">SMA/SMK</SelectItem>
                  <SelectItem value="d3">D3</SelectItem>
                  <SelectItem value="s1">S1</SelectItem>
                  <SelectItem value="s2">S2</SelectItem>
                  <SelectItem value="s3">S3</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Pengalaman Minimal */}
            <div className="space-y-2">
              <Label htmlFor="pengalaman-minimal">Pengalaman Minimal</Label>
              <Select value={pengalamanMinimal} onValueChange={setPengalamanMinimal}>
                <SelectTrigger id="pengalaman-minimal" className="rounded-xl w-full">
                  <SelectValue placeholder="Pilih pengalaman" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fresh-graduate">Fresh Graduate</SelectItem>
                  <SelectItem value="1-tahun">1 Tahun</SelectItem>
                  <SelectItem value="2-tahun">2 Tahun</SelectItem>
                  <SelectItem value="3-tahun">3 Tahun</SelectItem>
                  <SelectItem value="5-tahun">5 Tahun</SelectItem>
                  <SelectItem value="10-tahun">10 Tahun</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Kualifikasi Lainnya */}
          <div className="space-y-2">
            <Label htmlFor="kualifikasi-lainnya">Kualifikasi Lainnya</Label>
            <Textarea
              id="kualifikasi-lainnya"
              rows={3}
              value={kualifikasiLainnya}
              onChange={(e) => setKualifikasiLainnya(e.target.value)}
              className="rounded-xl"
              placeholder="Jelaskan kualifikasi tambahan secara detail..."
            />
          </div>

          {/* Deskripsi Pekerjaan */}
          <div className="space-y-2">
            <Label>Deskripsi Pekerjaan</Label>
            <div className="space-y-2">
              {deskripsiPekerjaan.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={item}
                    onChange={(e) => updateDeskripsi(index, e.target.value)}
                    className="rounded-xl"
                    placeholder="Deskripsi pekerjaan..."
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeDeskripsi(index)}
                    className="shrink-0"
                  >
                    <TrashBinTrash
                      weight="BoldDuotone"
                      className="h-4 w-4 text-destructive"
                    />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full gap-1.5"
                onClick={addDeskripsi}
              >
                <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                Tambah
              </Button>
            </div>
          </div>

          {/* Catatan Tambahan */}
          <div className="space-y-2">
            <Label>Catatan Tambahan</Label>
            <div className="space-y-2">
              {catatanTambahan.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={item}
                    onChange={(e) => updateCatatan(index, e.target.value)}
                    className="rounded-xl"
                    placeholder="Catatan tambahan..."
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCatatan(index)}
                    className="shrink-0"
                  >
                    <TrashBinTrash
                      weight="BoldDuotone"
                      className="h-4 w-4 text-destructive"
                    />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full gap-1.5"
                onClick={addCatatan}
              >
                <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                Tambah
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Yang Menyetujui 1 */}
            <div className="space-y-2">
              <Label htmlFor="yang-menyetujui-1">Yang Menyetujui (1)</Label>
              <Select value={yangMenyetujui1} onValueChange={setYangMenyetujui1}>
                <SelectTrigger id="yang-menyetujui-1" className="rounded-xl w-full">
                  <SelectValue placeholder="Pilih penyetuju" />
                </SelectTrigger>
                <SelectContent>
                  {userOptions.map((u) => (
                    <SelectItem key={u.profileId} value={u.profileId}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Yang Menyetujui 2 */}
            <div className="space-y-2">
              <Label htmlFor="yang-menyetujui-2">Yang Menyetujui (2)</Label>
              <Select value={yangMenyetujui2} onValueChange={setYangMenyetujui2}>
                <SelectTrigger id="yang-menyetujui-2" className="rounded-xl w-full">
                  <SelectValue placeholder="Pilih penyetuju" />
                </SelectTrigger>
                <SelectContent>
                  {userOptions.map((u) => (
                    <SelectItem key={u.profileId} value={u.profileId}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Section C: DIAJUKAN OLEH */}
        <div className="space-y-4">
          <h3 className="text-base font-heading font-semibold text-foreground">
            C. DIAJUKAN OLEH
          </h3>
          <Separator />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Nama */}
            <div className="space-y-2">
              <Label htmlFor="pengaju-nama">Nama</Label>
              <Input
                id="pengaju-nama"
                value={user?.name ?? "-"}
                disabled
                className="rounded-xl bg-muted text-muted-foreground"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="pengaju-email">Email</Label>
              <Input
                id="pengaju-email"
                value={user?.email ?? "-"}
                disabled
                className="rounded-xl bg-muted text-muted-foreground"
              />
            </div>
          </div>

          {/* Signature */}
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium text-foreground cursor-pointer">
                  Gunakan Tanda Tangan Default
                </Label>
                {!defaultSignature && (
                  <p className="text-xs text-muted-foreground">
                    Atur dulu di Profil &rsaquo; Tanda Tangan Default
                  </p>
                )}
              </div>
              <Switch
                checked={useDefaultSig}
                disabled={!defaultSignature}
                onCheckedChange={(checked) => {
                  setUseDefaultSig(checked);
                  if (checked && defaultSignature) {
                    setSignature(defaultSignature);
                  } else {
                    setSignature(null);
                  }
                }}
              />
            </div>

            {!useDefaultSig && (
              <SignaturePad onSignature={setSignature} label="Tanda Tangan Pengaju" />
            )}

            {useDefaultSig && defaultSignature && (
              <div className="rounded-xl border border-border bg-white p-3 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={defaultSignature} alt="Tanda tangan default" className="max-h-28 max-w-full object-contain" />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={onClose}
          >
            Batal
          </Button>
          <Button
            type="button"
            className="rounded-full gap-1.5"
            disabled={createMutation.isPending}
            onClick={handleSubmit}
          >
            <AddCircle weight="BoldDuotone" className="h-4 w-4" />
            Simpan
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
