"use client";

import type { ReactNode } from "react";
import type { Decimal } from "@prisma/client/runtime/client";
import { Drawer } from "@/components/shared/drawer";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProcurementItem } from "@/lib/queries/procurement";

interface ProcurementDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ProcurementItem | null;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; dotClass: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING: { label: "Menunggu", dotClass: "bg-amber-500", variant: "outline" },
  APPROVED: { label: "Disetujui", dotClass: "bg-blue-500", variant: "default" },
  REJECTED: { label: "Ditolak", dotClass: "bg-destructive", variant: "destructive" },
  COMPLETED: { label: "Selesai", dotClass: "bg-green-500", variant: "secondary" },
};

const LONG_INDONESIAN_MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const parsed = new Date(date);
  const day = parsed.getDate();
  const month = LONG_INDONESIAN_MONTHS[parsed.getMonth()] ?? "";
  const year = parsed.getFullYear();
  return `${day} ${month} ${year}`;
}

function formatCurrency(val: Decimal | number | string | null | undefined): string {
  if (val == null) return "—";
  const num = typeof val === "number" ? val : Number(val);
  const whole = Math.trunc(Math.abs(num));
  const formatted = whole
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `Rp ${num < 0 ? "-" : ""}${formatted}`;
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium text-foreground">{value ?? "—"}</div>
    </div>
  );
}

export function ProcurementDetailDrawer({
  open,
  onOpenChange,
  item,
}: ProcurementDetailDrawerProps): ReactNode {
  if (!item) return null;

  const cfg = STATUS_CONFIG[item.status] ?? {
    label: item.status,
    dotClass: "bg-muted-foreground",
    variant: "outline" as const,
  };
  const isImage = item.buktiBelUrl
    ? /\.(jpg|jpeg|png|webp|gif)$/i.test(item.buktiBelUrl)
    : false;

  return (
    <Drawer
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title="Detail Pengadaan"
      maxWidth="sm:max-w-xl"
    >
      <div className="space-y-5 pb-4">
        {/* Status row */}
        <div className="flex items-center gap-3">
          <Badge
            variant={cfg.variant}
            className="flex items-center gap-1.5 rounded-full text-xs"
          >
            <span
              className={cn(
                "inline-block w-1.5 h-1.5 rounded-full shrink-0",
                cfg.dotClass
              )}
            />
            {cfg.label}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Dibuat {formatDate(item.createdAt)}
          </span>
        </div>

        {/* Section: Info Dasar */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Info Dasar</p>
          <div className="bg-muted/30 rounded-2xl p-4 space-y-4">
            <Field label="Nama Barang" value={
              <span className="text-base font-semibold">{item.namaBarang}</span>
            } />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tanggal Permintaan" value={formatDate(item.tanggalPermintaan)} />
              <Field label="Venue" value={item.venue?.name} />
              <Field label="PIC Penerima" value={item.picPenerima} />
              {item.division && <Field label="Divisi" value={item.division} />}
            </div>
            {item.penggunaan && (
              <Field label="Penggunaan" value={item.penggunaan} />
            )}
          </div>
        </div>

        {/* Section: Kuantitas & Harga */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kuantitas & Harga</p>
          <div className="bg-muted/30 rounded-2xl p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Jumlah Barang" value={item.jumlahBarang} />
              <Field label="Sisa Barang" value={item.sisaBarang} />
              <Field label="Harga per Unit" value={formatCurrency(item.harga)} />
              <Field label="Petty Cash" value={formatCurrency(item.pettyCash)} />
            </div>
          </div>
        </div>

        {/* Section: Detail Acara */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Detail Acara</p>
          <div className="bg-muted/30 rounded-2xl p-4 space-y-4">
            <Field
              label="Keterangan Acara"
              value={item.keteranganAcara === "WEDDING" ? "Wedding" : "Non Wedding"}
            />
            {(item.weddingNote ?? item.nonWeddingNote) && (
              <div className="grid grid-cols-2 gap-4">
                {item.weddingNote && <Field label="Wedding Note" value={item.weddingNote} />}
                {item.nonWeddingNote && <Field label="Non Wedding Note" value={item.nonWeddingNote} />}
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <Field label="Total Wedding" value={formatCurrency(item.totalWedding)} />
              <Field label="Total Non Wedding" value={formatCurrency(item.totalNonWedding)} />
              <Field label="Total" value={
                <span className="font-semibold">{formatCurrency(item.total)}</span>
              } />
            </div>
          </div>
        </div>

        {/* Section: Informasi Tambahan */}
        {(item.linkBarang ?? item.note ?? item.keterangan ?? item.buktiBelUrl) && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Informasi Tambahan</p>
            <div className="bg-muted/30 rounded-2xl p-4 space-y-4">
              {item.linkBarang && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Link Barang</p>
                  <a
                    href={item.linkBarang}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary underline break-all hover:opacity-80 transition-opacity"
                  >
                    {item.linkBarang}
                  </a>
                </div>
              )}
              {item.note && <Field label="Catatan" value={item.note} />}
              {item.keterangan && <Field label="Keterangan" value={item.keterangan} />}
              {item.buktiBelUrl && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Bukti Beli</p>
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.buktiBelUrl}
                      alt="Bukti beli"
                      className="rounded-xl max-h-48 object-cover w-full"
                    />
                  ) : (
                    <a
                      href={item.buktiBelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary underline hover:opacity-80 transition-opacity"
                    >
                      Lihat file bukti beli
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Meta */}
        <div className="text-xs text-muted-foreground space-y-1.5 border-t border-border pt-4">
          {item.createdBy && (
            <p>
              Dibuat oleh:{" "}
              <span className="font-medium text-foreground">
                {item.createdBy.fullName ?? item.createdBy.nickName ?? "—"}
              </span>
            </p>
          )}
          {item.approvedBy && (
            <p>
              Disetujui oleh:{" "}
              <span className="font-medium text-foreground">
                {item.approvedBy.fullName ?? "—"}
              </span>
              {" "}· {formatDate(item.approvedAt)}
            </p>
          )}
        </div>
      </div>
    </Drawer>
  );
}
