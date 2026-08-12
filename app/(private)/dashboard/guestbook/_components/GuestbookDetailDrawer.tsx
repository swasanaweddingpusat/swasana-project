"use client";

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
} from "@solar-icons/react";
import type { GuestbookEntryItem } from "@/lib/queries/guestbookEntries";

interface GuestbookDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: GuestbookEntryItem | null;
}

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
}: GuestbookDetailDrawerProps): ReactNode {
  if (!entry) return null;

  const isActive = entry.checkOutAt === null;
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
              className="h-16 w-16 rounded-2xl object-cover shrink-0"
              unoptimized
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

        {/* ID photo */}
        {idPhoto && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Foto Identitas
            </p>
            <Image
              src={idPhoto}
              alt="Foto identitas"
              width={400}
              height={240}
              className="rounded-2xl object-cover w-full max-h-48"
              unoptimized
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

        {/* Meta */}
        <div className="text-xs text-muted-foreground space-y-1 border-t border-border pt-3">
          {entry.createdBy && (
            <p>Dicatat oleh: {entry.createdBy.fullName ?? "—"}</p>
          )}
          <p>Tanggal dibuat: {formatDateTime(entry.createdAt)}</p>
        </div>
      </div>
    </Drawer>
  );
}
