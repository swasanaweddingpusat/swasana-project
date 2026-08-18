"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useCreateMemo } from "@/hooks/use-memos";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { SimpleEditor } from "@/components/shared/SimpleEditor";

interface MemoCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type MemoForm = {
  ruangLingkup: string;
  judul: string;
  kepada: string;
  tembusan: string;
  perihal: string;
  jenisInformasi: string;
  klasifikasi: string;
  yangMenyetujui: string;
  yangMengetahui: string;
  isiMemo: string;
};

const EMPTY_FORM: MemoForm = {
  ruangLingkup: "",
  judul: "",
  kepada: "",
  tembusan: "",
  perihal: "",
  jenisInformasi: "",
  klasifikasi: "",
  yangMenyetujui: "",
  yangMengetahui: "",
  isiMemo: "",
};

const KEPADA_OPTIONS = [
  "Seluruh Karyawan",
  "Divisi HRD",
  "Divisi Finance",
  "Divisi Marketing",
  "Manajemen",
];

const APPROVER_OPTIONS = [
  "Direktur Utama",
  "Direktur Operasional",
  "Direktur Keuangan",
  "GM",
];

export function MemoCreateDialog({ open, onOpenChange }: MemoCreateDialogProps) {
  const [form, setForm] = useState<MemoForm>(EMPTY_FORM);
  const createMutation = useCreateMemo();

  function setField<K extends keyof MemoForm>(key: K, value: MemoForm[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const [prevOpen, setPrevOpen] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setForm(EMPTY_FORM);
    }
  }

  function handleSubmit(): void {
    if (!form.judul.trim()) {
      toast.error("Judul wajib diisi");
      return;
    }
    createMutation.mutate(form, {
      onSuccess: (res) => {
        if (res.success) {
          toast.success("Memo berhasil disimpan");
          setForm(EMPTY_FORM);
          onOpenChange(false);
        } else {
          toast.error(res.error ?? "Gagal menyimpan memo");
        }
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah Memo Baru</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Row 1: Ruang Lingkup (full width) */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Ruang Lingkup</Label>
            <Select
              value={form.ruangLingkup}
              onValueChange={(v) => setField("ruangLingkup", v)}
            >
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue placeholder="Pilih ruang lingkup" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Internal">Internal</SelectItem>
                <SelectItem value="Eksternal">Eksternal</SelectItem>
                <SelectItem value="Semua">Semua</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Row 2: Judul (full width) */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Judul</Label>
            <Input
              className="rounded-xl"
              placeholder="Masukkan judul memo"
              value={form.judul}
              onChange={(e) => setField("judul", e.target.value)}
            />
          </div>

          {/* Row 3: Kepada + Tembusan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Kepada</Label>
              <Select
                value={form.kepada}
                onValueChange={(v) => setField("kepada", v)}
              >
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue placeholder="Pilih penerima" />
                </SelectTrigger>
                <SelectContent>
                  {KEPADA_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Tembusan</Label>
              <Select
                value={form.tembusan}
                onValueChange={(v) => setField("tembusan", v)}
              >
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue placeholder="Pilih tembusan" />
                </SelectTrigger>
                <SelectContent>
                  {KEPADA_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 4: Perihal (full width) */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Perihal</Label>
            <Textarea
              className="rounded-xl"
              rows={3}
              placeholder="Masukkan perihal memo"
              value={form.perihal}
              onChange={(e) => setField("perihal", e.target.value)}
            />
          </div>

          {/* Row 5: Jenis Informasi + Klasifikasi */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Jenis Informasi</Label>
              <Select
                value={form.jenisInformasi}
                onValueChange={(v) => setField("jenisInformasi", v)}
              >
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue placeholder="Pilih jenis informasi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pengumuman">Pengumuman</SelectItem>
                  <SelectItem value="Kebijakan">Kebijakan</SelectItem>
                  <SelectItem value="SOP">SOP</SelectItem>
                  <SelectItem value="Edaran">Edaran</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Klasifikasi</Label>
              <Select
                value={form.klasifikasi}
                onValueChange={(v) => setField("klasifikasi", v)}
              >
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue placeholder="Pilih klasifikasi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Umum">Umum</SelectItem>
                  <SelectItem value="Rahasia">Rahasia</SelectItem>
                  <SelectItem value="Sangat Rahasia">Sangat Rahasia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 6: Yang Menyetujui + Yang Mengetahui */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Yang Menyetujui</Label>
              <Select
                value={form.yangMenyetujui}
                onValueChange={(v) => setField("yangMenyetujui", v)}
              >
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue placeholder="Pilih yang menyetujui" />
                </SelectTrigger>
                <SelectContent>
                  {APPROVER_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Yang Mengetahui</Label>
              <Select
                value={form.yangMengetahui}
                onValueChange={(v) => setField("yangMengetahui", v)}
              >
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue placeholder="Pilih yang mengetahui" />
                </SelectTrigger>
                <SelectContent>
                  {APPROVER_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 7: Isi Memo (full width) */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Isi Memo</Label>
            <SimpleEditor
              value={form.isiMemo}
              onChange={(v) => setField("isiMemo", v)}
              placeholder="Tulis isi memo..."
            />
          </div>

          {/* Row 8: Disusun dan Direkomendasikan Oleh (read-only) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Disusun dan Direkomendasikan Oleh — Nama
              </Label>
              <Input
                className="rounded-xl bg-muted"
                readOnly
                value="(Auto)"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Disusun dan Direkomendasikan Oleh — Jabatan
              </Label>
              <Input
                className="rounded-xl bg-muted"
                readOnly
                value="(Auto)"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button className="rounded-full" onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Menyimpan..." : "Submit"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
