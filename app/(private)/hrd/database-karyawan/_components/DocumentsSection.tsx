"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PermissionGate } from "@/components/shared/permission-gate";
import { DocumentUploadModal } from "./DocumentUploadModal";
import {
  useEmployeeDocuments,
  useDeleteEmployeeDocument,
} from "@/hooks/use-employees";
import {
  AddCircle,
  Eye,
  TrashBinTrash,
  Document,
} from "@solar-icons/react";
import type { EmployeeDocumentItem } from "@/lib/queries/employees";

// ─── Constants ───────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  ktp: "KTP",
  npwp: "NPWP",
  bpjs_kes: "BPJS Kesehatan",
  bpjs_tk: "BPJS TK",
  contract: "Kontrak",
  ijazah: "Ijazah",
  certificate: "Sertifikat",
  other: "Lainnya",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(date: string | Date | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface DocumentsSectionProps {
  employeeId: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DocumentsSection({ employeeId }: DocumentsSectionProps) {
  const { data: documents, isLoading } = useEmployeeDocuments(employeeId);
  const deleteMutation = useDeleteEmployeeDocument();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeDocumentItem | null>(
    null
  );

  const handlePreview = useCallback((doc: EmployeeDocumentItem) => {
    window.open(doc.fileUrl, "_blank");
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: (result) => {
        if (result.success) {
          toast.success("Dokumen berhasil dihapus");
        } else {
          toast.error(result.error ?? "Gagal menghapus dokumen");
        }
        setDeleteTarget(null);
      },
      onError: () => {
        toast.error("Terjadi kesalahan");
        setDeleteTarget(null);
      },
    });
  }, [deleteTarget, deleteMutation]);

  return (
    <>
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-lg">
              Dokumen Karyawan
            </CardTitle>
            <PermissionGate module="hr" action="edit">
              <Button
                size="sm"
                className="rounded-full gap-1.5"
                onClick={() => setUploadOpen(true)}
              >
                <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                Upload Dokumen
              </Button>
            </PermissionGate>
          </div>
        </CardHeader>
        <CardContent>
          {/* Loading */}
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          )}

          {/* Empty */}
          {!isLoading && (!documents || documents.length === 0) && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Document
                weight="BoldDuotone"
                className="h-12 w-12 text-muted-foreground/40"
              />
              <p className="mt-3 text-sm text-muted-foreground">
                Belum ada dokumen yang diunggah
              </p>
            </div>
          )}

          {/* Data */}
          {!isLoading && documents && documents.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Nama Dokumen</TableHead>
                    <TableHead>Ukuran</TableHead>
                    <TableHead>Kadaluarsa</TableHead>
                    <TableHead>Tgl Upload</TableHead>
                    <TableHead>Diupload Oleh</TableHead>
                    <TableHead className="w-24 text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full">
                          {DOC_TYPE_LABELS[doc.type] ?? doc.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {doc.name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatFileSize(doc.fileSize)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(doc.expiresAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(doc.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {doc.uploader?.fullName ?? "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            onClick={() => handlePreview(doc)}
                          >
                            <Eye
                              weight="BoldDuotone"
                              className="h-4 w-4"
                            />
                          </Button>
                          <PermissionGate module="hr" action="edit">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(doc)}
                            >
                              <TrashBinTrash
                                weight="BoldDuotone"
                                className="h-4 w-4"
                              />
                            </Button>
                          </PermissionGate>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Upload Modal ──────────────────────────────────────────── */}
      <DocumentUploadModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        employeeId={employeeId}
      />

      {/* ─── Delete Confirmation Dialog ────────────────────────────── */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">Hapus Dokumen</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus dokumen{" "}
              <span className="font-semibold">{deleteTarget?.name}</span>?
              Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setDeleteTarget(null)}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              className="rounded-full"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
