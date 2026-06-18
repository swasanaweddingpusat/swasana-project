"use client";

import { useState, useRef, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Camera, Gallery, Pen, MagniferZoomIn, MagniferZoomOut, Refresh } from "@solar-icons/react";
import { toast } from "sonner";
import { getInitials } from "@/lib/utils";
import { getCroppedBlob } from "@/lib/image-utils";

const S3_PUBLIC_URL = process.env.NEXT_PUBLIC_S3_PUBLIC_URL ?? "";

function toFullUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.startsWith("http")) return key;
  return S3_PUBLIC_URL ? `${S3_PUBLIC_URL}/${key}` : key;
}

interface AvatarUploadProps {
  currentUrl: string | null;
  name: string;
  onUploaded: (key: string) => void;
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(() => toFullUrl(currentUrl));
  // Derive the storage key from a URL (strip base) or use as-is if already a key
  const [currentKey, setCurrentKey] = useState<string | null>(() => {
    if (!currentUrl) return null;
    if (currentUrl.startsWith("http") && S3_PUBLIC_URL) {
      return currentUrl.replace(`${S3_PUBLIC_URL}/`, "");
    }
    return currentUrl;
  });

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
      // 1. Crop to blob (canvas-based, client-side)
      const blob = await getCroppedBlob(imageSrc, croppedArea);

      // 2. Send multipart to server (server will compress webp q50 1920)
      const fd = new FormData();
      fd.set("file", new File([blob], "avatar.webp", { type: "image/webp" }));

      const uploadRes = await fetch("/api/upload/avatar", { method: "POST", body: fd });
      if (!uploadRes.ok) {
        const err = (await uploadRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Upload gagal");
      }
      const { key } = await uploadRes.json() as { key: string };

      // 3. Save key to DB (delete old key from storage if different)
      const saveRes = await fetch("/api/upload/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarKey: key, oldKey: currentKey ?? undefined }),
      });
      if (!saveRes.ok) throw new Error("Gagal menyimpan foto profil");

      setCurrentKey(key);
      setPreviewUrl(toFullUrl(key));
      onUploaded(key);
      setCropOpen(false);
      toast.success("Foto profil berhasil diupdate");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal upload foto");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="relative w-fit">
        <Avatar className="h-20 w-20">
          <AvatarImage src={previewUrl ?? ""} />
          <AvatarFallback className="text-xl">{getInitials(name)}</AvatarFallback>
        </Avatar>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="absolute bottom-0 right-0 p-1.5 bg-primary text-primary-foreground rounded-full shadow cursor-pointer hover:bg-primary/90 transition-colors">
              <Pen weight="BoldDuotone" className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom" className="w-44">
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
              <Gallery weight="BoldDuotone" className="h-4 w-4 mr-2" />
              Pilih dari Galeri
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => cameraInputRef.current?.click()}>
              <Camera weight="BoldDuotone" className="h-4 w-4 mr-2" />
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
            <MagniferZoomOut weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-gray-900"
            />
            <MagniferZoomIn weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>

          {/* Actions */}
          <div className="flex gap-2 px-4 pb-4">
            <Button variant="outline" className="flex-1" onClick={() => setCropOpen(false)} disabled={uploading}>
              Batal
            </Button>
            <Button className="flex-1" onClick={handleCropAndUpload} disabled={uploading}>
              {uploading ? <><Refresh weight="BoldDuotone" className="h-4 w-4 animate-spin mr-2" /> Uploading...</> : "Simpan Foto"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
