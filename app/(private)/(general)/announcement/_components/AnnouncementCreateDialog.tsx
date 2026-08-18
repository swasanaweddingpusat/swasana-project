"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useCreateAnnouncement } from "@/hooks/use-announcements";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SimpleEditor } from "@/components/shared/SimpleEditor";

interface AnnouncementCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type AnnouncementForm = {
  title: string;
  category: string;
  priority: string;
  targetAudience: string;
  content: string;
};

const EMPTY_FORM: AnnouncementForm = {
  title: "",
  category: "",
  priority: "",
  targetAudience: "",
  content: "",
};

export function AnnouncementCreateDialog({
  open,
  onOpenChange,
}: AnnouncementCreateDialogProps) {
  const [form, setForm] = useState<AnnouncementForm>(EMPTY_FORM);
  const createMutation = useCreateAnnouncement();

  function setField<K extends keyof AnnouncementForm>(
    key: K,
    value: AnnouncementForm[K]
  ): void {
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
    if (!form.title.trim()) {
      toast.error("Judul wajib diisi");
      return;
    }
    createMutation.mutate(form, {
      onSuccess: (res) => {
        if (res.success) {
          toast.success("Pengumuman berhasil disimpan");
          setForm(EMPTY_FORM);
          onOpenChange(false);
        } else {
          toast.error(res.error ?? "Gagal menyimpan pengumuman");
        }
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah Pengumuman Baru</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Judul — full width */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Judul</Label>
            <Input
              className="rounded-xl"
              placeholder="Masukkan judul pengumuman"
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
            />
          </div>

          {/* Kategori + Prioritas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Kategori</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setField("category", v)}
              >
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Umum">Umum</SelectItem>
                  <SelectItem value="IT">IT</SelectItem>
                  <SelectItem value="HRD">HRD</SelectItem>
                  <SelectItem value="Manajemen">Manajemen</SelectItem>
                  <SelectItem value="Operasional">Operasional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Prioritas</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setField("priority", v)}
              >
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue placeholder="Pilih prioritas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Target Audience */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Target Audience</Label>
            <Select
              value={form.targetAudience}
              onValueChange={(v) => setField("targetAudience", v)}
            >
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue placeholder="Pilih target audience" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Seluruh Karyawan">Seluruh Karyawan</SelectItem>
                <SelectItem value="Divisi Tertentu">Divisi Tertentu</SelectItem>
                <SelectItem value="Manajemen">Manajemen</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Konten — rich text */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Konten</Label>
            <SimpleEditor
              value={form.content}
              onChange={(v) => setField("content", v)}
              placeholder="Tulis isi pengumuman..."
            />
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
          <Button
            className="rounded-full"
            onClick={handleSubmit}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "Menyimpan..." : "Submit"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
