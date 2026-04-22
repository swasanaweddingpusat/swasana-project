"use client";

import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { uploadBookingDocument } from "@/actions/booking-document";

interface UploadDocumentModalProps {
  open: boolean;
  onClose: () => void;
  bookingId: string;
  bookingName: string;
}

const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function truncName(name: string, max = 30) {
  if (name.length <= max) return name;
  const dot = name.lastIndexOf(".");
  if (dot === -1) return name.slice(0, max) + "...";
  const ext = name.slice(dot);
  return `${name.slice(0, max - ext.length - 3)}...${ext}`;
}

export function UploadDocumentModal({ open, onClose, bookingId, bookingName }: UploadDocumentModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docName, setDocName] = useState("");
  const [docDescription, setDocDescription] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  React.useEffect(() => {
    if (!open) { setDocName(""); setDocDescription(""); setSelectedFiles([]); }
  }, [open]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid: File[] = [];
    for (const f of files) {
      if (!ALLOWED_TYPES.includes(f.type)) { toast.error(`${f.name}: Tipe file tidak didukung`); continue; }
      if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name}: File terlalu besar (max 10 MB)`); continue; }
      valid.push(f);
    }
    setSelectedFiles((prev) => [...prev, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!docName.trim()) { toast.error("Nama dokumen wajib diisi"); return; }
    if (selectedFiles.length === 0) { toast.error("Pilih minimal 1 file"); return; }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("bookingId", bookingId);
      fd.set("name", docName.trim());
      fd.set("description", docDescription.trim());
      for (const f of selectedFiles) fd.append("files", f);

      const result = await uploadBookingDocument(fd);
      if (!result.success) { toast.error(result.error); return; }
      toast.success(`${result.count} file berhasil diupload`);
      onClose();
    } catch {
      toast.error("Gagal mengupload file");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden">
        <DialogTitle className="text-base font-semibold">Dokumen. {bookingName}</DialogTitle>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Nama Dokumen *</label>
            <Input value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="Contoh: Surat Perjanjian, Invoice, dll" className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Deskripsi</label>
            <Textarea value={docDescription} onChange={(e) => setDocDescription(e.target.value)} placeholder="Deskripsi singkat (opsional)" className="mt-1 min-h-[60px] resize-none" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">File (multiple)</label>
            <div className="relative flex items-center w-full px-3 py-2 border rounded-md bg-[#FAFAFA] text-[#667085] gap-2 cursor-pointer mt-1">
              <FileText className="w-4 h-4" />
              <span className="text-sm">Pilih file untuk diupload</span>
              <input ref={fileInputRef} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileSelect} className="absolute inset-0 cursor-pointer opacity-0" style={{ width: "100%", height: "100%" }} />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Image (JPG, PNG, WebP) akan di-compress ke WebP. File lain max 10 MB.</p>
          </div>

          {selectedFiles.length > 0 && (
            <div className="space-y-1">
              {selectedFiles.map((f, i) => (
                <div key={i} className="flex items-center w-full px-3 py-2 border rounded-md bg-[#FAFAFA] text-[#667085] gap-2 min-w-0">
                  <FileText className="w-4 h-4 shrink-0" />
                  <span className="flex-1 truncate text-sm min-w-0">{truncName(f.name)}</span>
                  <span className="text-xs text-gray-400 shrink-0">({formatSize(f.size)})</span>
                  <button type="button" className="text-red-500 hover:text-red-700 shrink-0" onClick={() => setSelectedFiles((prev) => prev.filter((_, idx) => idx !== i))}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Button className="w-full" onClick={handleUpload} disabled={uploading || !docName.trim() || selectedFiles.length === 0}>
            {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Mengupload...</> : <><Upload className="h-4 w-4 mr-2" /> Upload File</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
