"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import { Drawer } from "@/components/shared/drawer";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Buildings3,
  Letter,
  Phone,
  Card2,
  UsersGroupRounded,
  Calendar,
  ClipboardText,
  User,
  CloseCircle,
} from "@solar-icons/react";
import type { GuestbookEntryItem } from "@/lib/queries/guestbookEntries";

interface GuestbookDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: GuestbookEntryItem | null;
  allEntries: GuestbookEntryItem[];
}

const VISIT_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  deal: { label: "Deal", className: "bg-green-100 text-green-700 border-0" },
  to_be_discuss: { label: "To Be Discuss", className: "bg-yellow-100 text-yellow-700 border-0" },
  not_joined: { label: "Not Joined", className: "bg-red-100 text-red-700 border-0" },
};

const PURPOSE_LABELS: Record<string, string> = {
  client_visit: "Kunjungan Client",
  vendor_meeting: "Meeting Vendor",
  interview: "Interview",
  delivery: "Pengiriman",
  other: "Lainnya",
};

function resolvePhotoUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.startsWith("http")) return key;
  const base = process.env.NEXT_PUBLIC_S3_PUBLIC_URL;
  if (!base) return null;
  return `${base}/${key}`;
}

function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}): ReactNode {
  if (!value || value === "—") return null;
  return (
    <div className="flex items-start gap-3">
      <div className="p-2 rounded-xl bg-secondary shrink-0">{icon}</div>
      <div className="min-w-0 space-y-0.5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm font-medium text-foreground break-words">
          {value}
        </div>
      </div>
    </div>
  );
}

export function GuestbookDetailDrawer({
  open,
  onOpenChange,
  entry,
  allEntries,
}: GuestbookDetailDrawerProps): ReactNode {
  const [overlayImage, setOverlayImage] = useState<string | null>(null);

  if (!entry) return null;

  const isActive = entry.checkOutAt === null;

  const matchingEntries = allEntries.filter(
    (e) =>
      e.id !== entry.id &&
      e.visitorName.toLowerCase() === entry.visitorName.toLowerCase() &&
      e.phoneNumber != null &&
      entry.phoneNumber != null &&
      e.phoneNumber === entry.phoneNumber
  );
  const totalVisit = matchingEntries.length + 1;
  const visitorPhoto = resolvePhotoUrl(entry.visitorPhotoUrl);
  const idPhoto = resolvePhotoUrl(entry.idPhotoUrl);

  return (
    <Drawer
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title="Detail Tamu"
      maxWidth="sm:max-w-lg"
    >
      <div className="space-y-5 pb-4">
        {/* Visitor header */}
        <div className="flex items-center gap-4">
          {visitorPhoto ? (
            <Image
              src={visitorPhoto}
              alt={entry.visitorName}
              width={64}
              height={64}
              className="h-16 w-16 rounded-2xl object-cover shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
              unoptimized
              onClick={() => setOverlayImage(visitorPhoto)}
            />
          ) : (
            <div className="h-16 w-16 rounded-2xl bg-secondary flex items-center justify-center shrink-0">
              <User
                weight="BoldDuotone"
                className="h-7 w-7 text-muted-foreground"
              />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-lg font-heading font-bold text-foreground truncate">
              {entry.visitorName}
            </h3>
            {entry.guestCode && (
              <p className="text-xs text-muted-foreground font-mono">{entry.guestCode}</p>
            )}
            {entry.company && (
              <p className="text-sm text-muted-foreground">{entry.company}</p>
            )}
            <div className="mt-1.5">
              {isActive ? (
                <Badge className="rounded-full text-xs bg-green-100 text-green-700 border-0">
                  Masih di Lokasi
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className="rounded-full text-xs"
                >
                  Selesai
                </Badge>
              )}
            </div>
          </div>
        </div>

        <Separator />

        {/* Photos section */}
        {(visitorPhoto || idPhoto) && (
          <div className="bg-muted/30 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Foto
            </p>
            <div className="grid grid-cols-2 gap-3">
              {/* Foto Tamu */}
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Foto Tamu</p>
                {visitorPhoto ? (
                  <Image
                    src={visitorPhoto}
                    alt="Foto tamu"
                    width={300}
                    height={200}
                    className="rounded-xl object-cover w-full aspect-[4/3] cursor-pointer hover:opacity-80 transition-opacity"
                    unoptimized
                    onClick={() => setOverlayImage(visitorPhoto)}
                  />
                ) : (
                  <div className="rounded-xl bg-secondary flex items-center justify-center w-full aspect-[4/3]">
                    <User weight="BoldDuotone" className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                )}
              </div>

              {/* Foto KTP */}
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Foto KTP</p>
                {idPhoto ? (
                  <Image
                    src={idPhoto}
                    alt="Foto KTP"
                    width={300}
                    height={200}
                    className="rounded-xl object-cover w-full aspect-[4/3] cursor-pointer hover:opacity-80 transition-opacity"
                    unoptimized
                    onClick={() => setOverlayImage(idPhoto)}
                  />
                ) : (
                  <div className="rounded-xl bg-secondary flex items-center justify-center w-full aspect-[4/3]">
                    <Card2 weight="BoldDuotone" className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Visit info */}
        <div className="bg-muted/30 rounded-2xl p-4 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Informasi Kunjungan
          </p>
          <InfoRow
            icon={
              <ClipboardText
                weight="BoldDuotone"
                className="h-4 w-4 text-muted-foreground"
              />
            }
            label="Tujuan"
            value={
              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className="rounded-full text-xs font-medium"
                >
                  {PURPOSE_LABELS[entry.purpose] ?? entry.purpose}
                </Badge>
                {entry.purposeNote && (
                  <span className="text-xs text-muted-foreground italic">
                    {entry.purposeNote}
                  </span>
                )}
              </div>
            }
          />
          <InfoRow
            icon={
              <Buildings3
                weight="BoldDuotone"
                className="h-4 w-4 text-muted-foreground"
              />
            }
            label="Venue"
            value={entry.venue?.name}
          />
          <InfoRow
            icon={
              <User
                weight="BoldDuotone"
                className="h-4 w-4 text-muted-foreground"
              />
            }
            label="Bertemu"
            value={entry.host?.fullName}
          />
          <InfoRow
            icon={
              <UsersGroupRounded
                weight="BoldDuotone"
                className="h-4 w-4 text-muted-foreground"
              />
            }
            label="Jumlah Tamu"
            value={`${entry.numberOfGuests} orang`}
          />
        </div>

        {/* Time info */}
        <div className="bg-muted/30 rounded-2xl p-4 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Waktu
          </p>
          <InfoRow
            icon={
              <Calendar
                weight="BoldDuotone"
                className="h-4 w-4 text-muted-foreground"
              />
            }
            label="Check-in"
            value={formatDateTime(entry.checkInAt)}
          />
          <InfoRow
            icon={
              <Calendar
                weight="BoldDuotone"
                className="h-4 w-4 text-muted-foreground"
              />
            }
            label="Check-out"
            value={
              entry.checkOutAt ? formatDateTime(entry.checkOutAt) : "Belum check-out"
            }
          />
        </div>

        {/* Contact info */}
        {(entry.email || entry.phoneNumber || entry.idNumber) && (
          <div className="bg-muted/30 rounded-2xl p-4 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Kontak
            </p>
            <InfoRow
              icon={
                <Letter
                  weight="BoldDuotone"
                  className="h-4 w-4 text-muted-foreground"
                />
              }
              label="Email"
              value={entry.email}
            />
            <InfoRow
              icon={
                <Phone
                  weight="BoldDuotone"
                  className="h-4 w-4 text-muted-foreground"
                />
              }
              label="Telepon"
              value={entry.phoneNumber}
            />
            <InfoRow
              icon={
                <Card2
                  weight="BoldDuotone"
                  className="h-4 w-4 text-muted-foreground"
                />
              }
              label="No. Identitas"
              value={entry.idNumber}
            />
          </div>
        )}

        {/* Notes */}
        {entry.notes && (
          <div className="bg-muted/30 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Catatan
            </p>
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {entry.notes}
            </p>
          </div>
        )}

        {/* Visit details */}
        <div className="bg-muted/30 rounded-2xl p-4 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Status Kunjungan
          </p>
          {entry.visitStatus && (() => {
            const statusInfo = VISIT_STATUS_LABELS[entry.visitStatus];
            if (!statusInfo) return null;
            return (
              <div className="flex items-center gap-2">
                <Badge className={`rounded-full text-xs ${statusInfo.className}`}>
                  {statusInfo.label}
                </Badge>
              </div>
            );
          })()}
          {entry.visitStatus === "not_joined" && entry.notJoinReason && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Alasan</p>
              <p className="text-sm text-foreground">{entry.notJoinReason}</p>
            </div>
          )}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Total Kunjungan</p>
            <p className="text-sm font-medium text-foreground">{totalVisit}x</p>
          </div>
        </div>

        {/* Visit History */}
        {matchingEntries.length > 0 && (
          <div className="bg-muted/30 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Riwayat Kunjungan ({matchingEntries.length})
            </p>
            <div className="space-y-2">
              {matchingEntries
                .sort((a, b) => new Date(b.checkInAt).getTime() - new Date(a.checkInAt).getTime())
                .slice(0, 10)
                .map((past) => {
                  const pastStatus = past.visitStatus ? VISIT_STATUS_LABELS[past.visitStatus] : null;
                  return (
                    <div key={past.id} className="flex items-center justify-between gap-2 text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0">
                      <div className="space-y-0.5">
                        <p className="text-foreground font-medium">{formatDateTime(past.checkInAt)}</p>
                        <p className="text-xs text-muted-foreground">{past.venue?.name ?? "—"}</p>
                      </div>
                      {pastStatus && (
                        <Badge className={`rounded-full text-[11px] shrink-0 ${pastStatus.className}`}>
                          {pastStatus.label}
                        </Badge>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Meta */}
        <div className="text-xs text-muted-foreground space-y-1 border-t border-border pt-3">
          {entry.createdBy && (
            <p>Dicatat oleh: {entry.createdBy.fullName ?? "—"}</p>
          )}
          <p>Tanggal dibuat: {formatDateTime(entry.createdAt)}</p>
        </div>
      </div>
      {overlayImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setOverlayImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
            onClick={() => setOverlayImage(null)}
          >
            <CloseCircle weight="BoldDuotone" className="h-8 w-8" />
          </button>
          <Image
            src={overlayImage}
            alt="Preview"
            width={1200}
            height={800}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-2xl"
            unoptimized
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </Drawer>
  );
}
