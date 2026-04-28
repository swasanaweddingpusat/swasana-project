"use client";

import { useState, useRef, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Camera, ImageUp, Pencil, ZoomIn, ZoomOut, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getInitials } from "@/lib/utils";
import { getCroppedBlob, compressToWebP } from "@/lib/image-utils";

interface AvatarUploadProps {
  currentUrl: string | null;
  name: string;
  onUploaded: (url: string) => void;
}

export function AvatarUpload({ currentUrl, name, onUploaded }: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [cropOpen, setCropOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedArea(croppedPixels);
  }, []);

  const openFile = (src: string) => {
    setImageSrc(src);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCropOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => openFile(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCropAndUpload = async () => {
    if (!imageSrc || !croppedArea) return;
    setUploading(true);
    try {
      // 1. Crop
      const blob = await getCroppedBlob(imageSrc, croppedArea);
      const rawFile = new File([blob], "avatar.webp", { type: "image/webp" });

      // 2. Compress to WebP
      const compressed = await compressToWebP(rawFile);

      // 3. Get presigned URL
      const res = await fetch("/api/upload/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: "image/webp" }),
      });
      if (!res.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, publicUrl } = await res.json() as { uploadUrl: string; publicUrl: string; key: string };

      // 4. Upload to R2
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/webp" },
        body: compressed,
      });
      if (!uploadRes.ok) throw new Error("Upload failed");

      // 5. Save to DB (delete old file if exists)
      const oldKey = preview ? preview.replace(/^https?:\/\/[^/]+\//, "") : undefined;
      const saveRes = await fetch("/api/upload/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: publicUrl, oldKey }),
      });
      if (!saveRes.ok) throw new Error("Failed to save");

      setPreview(publicUrl);
      onUploaded(publicUrl);
      setCropOpen(false);
      toast.success("Foto profil berhasil diupdate");
    } catch {
      toast.error("Gagal upload foto");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="relative w-fit">
        <Avatar className="h-20 w-20">
          <AvatarImage src={preview ?? ""} />
          <AvatarFallback className="text-xl">{getInitials(name)}</AvatarFallback>
        </Avatar>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="absolute bottom-0 right-0 p-1.5 bg-primary text-primary-foreground rounded-full shadow cursor-pointer hover:bg-primary/90 transition-colors">
              <Pencil className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom" className="w-44">
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
              <ImageUp className="h-4 w-4 mr-2" />
              Pilih dari Galeri
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => cameraInputRef.current?.click()}>
              <Camera className="h-4 w-4 mr-2" />
              Ambil Selfie
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Hidden inputs */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleFileChange} />

      {/* Crop Modal */}
      <Dialog open={cropOpen} onOpenChange={(o) => !uploading && setCropOpen(o)}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogTitle className="px-4 pt-4 text-sm font-semibold">Sesuaikan Foto</DialogTitle>

          {/* Cropper */}
          <div className="relative w-full h-72 bg-gray-900">
            {imageSrc && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            )}
          </div>

          {/* Zoom slider */}
          <div className="flex items-center gap-3 px-4 py-3 border-t">
            <ZoomOut className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-gray-900"
            />
            <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>

          {/* Actions */}
          <div className="flex gap-2 px-4 pb-4">
            <Button variant="outline" className="flex-1" onClick={() => setCropOpen(false)} disabled={uploading}>
              Batal
            </Button>
            <Button className="flex-1" onClick={handleCropAndUpload} disabled={uploading}>
              {uploading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Uploading...</> : "Simpan Foto"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
