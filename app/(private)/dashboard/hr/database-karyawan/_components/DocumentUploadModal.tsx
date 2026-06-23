"use client";

import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { useUploadEmployeeDocument } from "@/hooks/use-employees";
import { Upload } from "@solar-icons/react";

// ─── Constants ───────────────────────────────────────────────────────────────

const DOC_TYPE_OPTIONS = [
  { value: "ktp", label: "KTP" },
  { value: "npwp", label: "NPWP" },
  { value: "bpjs_kes", label: "BPJS Kesehatan" },
  { value: "bpjs_tk", label: "BPJS TK" },
  { value: "contract", label: "Kontrak" },
  { value: "ijazah", label: "Ijazah" },
  { value: "certificate", label: "Sertifikat" },
  { value: "other", label: "Lainnya" },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,.png,.doc,.docx";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DocumentUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
}

interface FormState {
  type: string;
  name: string;
  expiresAt: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DocumentUploadModal({
  open,
  onOpenChange,
  employeeId,
}: DocumentUploadModalProps) {
  const uploadMutation = useUploadEmployeeDocument();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>({
    type: "",
    name: "",
    expiresAt: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const resetForm = useCallback(() => {
    setForm({ type: "", name: "", expiresAt: "" });
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        resetForm();
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, resetForm]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null;
      setSelectedFile(file);
      if (file && !form.name) {
        setForm((prev) => ({ ...prev, name: file.name }));
      }
    },
    [form.name]
  );

  const handleChange = useCallback(
    (field: keyof FormState, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleSubmit = useCallback(() => {
    if (!form.type) {
      toast.error("Tipe dokumen wajib dipilih");
      return;
    }
    if (!form.name.trim()) {
      toast.error("Nama dokumen wajib diisi");
      return;
    }
    if (!selectedFile) {
      toast.error("File wajib diunggah");
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      toast.error("Ukuran file maksimal 10MB");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("type", form.type);
    formData.append("name", form.name.trim());
    if (form.expiresAt) {
      formData.append("expiresAt", form.expiresAt);
    }

    uploadMutation.mutate(
      { profileId: employeeId, formData },
      {
        onSuccess: (result) => {
          if (result.success) {
            toast.success("Dokumen berhasil diunggah");
            resetForm();
            onOpenChange(false);
          } else {
            toast.error(result.error ?? "Gagal mengunggah dokumen");
          }
        },
        onError: () => {
          toast.error("Terjadi kesalahan saat mengunggah");
        },
      }
    );
  }, [form, selectedFile, employeeId, uploadMutation, resetForm, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Upload Dokumen</DialogTitle>
          <DialogDescription>
            Unggah dokumen karyawan (maks. 10MB)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Document Type */}
          <div className="space-y-1.5">
            <Label className="text-sm">Tipe Dokumen</Label>
            <Select
              value={form.type}
              onValueChange={(v) => handleChange("type", v)}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Pilih tipe dokumen" />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Document Name */}
          <div className="space-y-1.5">
            <Label className="text-sm">Nama Dokumen</Label>
            <Input
              className="rounded-xl"
              placeholder="Nama dokumen"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
            />
          </div>

          {/* Expiry Date */}
          <div className="space-y-1.5">
            <Label className="text-sm">
              Tanggal Kadaluarsa{" "}
              <span className="text-muted-foreground">(opsional)</span>
            </Label>
            <Input
              type="date"
              className="rounded-xl"
              value={form.expiresAt}
              onChange={(e) => handleChange("expiresAt", e.target.value)}
            />
          </div>

          {/* File Input */}
          <div className="space-y-1.5">
            <Label className="text-sm">File</Label>
            <Input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              className="rounded-xl"
              onChange={handleFileChange}
            />
            {selectedFile && (
              <p className="text-xs text-muted-foreground">
                {selectedFile.name} (
                {(selectedFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => handleOpenChange(false)}
            disabled={uploadMutation.isPending}
          >
            Batal
          </Button>
          <Button
            className="rounded-full gap-1.5"
            onClick={handleSubmit}
            disabled={uploadMutation.isPending}
          >
            <Upload weight="BoldDuotone" className="h-4 w-4" />
            {uploadMutation.isPending ? "Mengunggah..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
