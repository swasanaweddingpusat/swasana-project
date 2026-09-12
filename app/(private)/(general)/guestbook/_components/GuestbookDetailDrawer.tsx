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
  Calendar,
  ClipboardText,
  User,
  CloseCircle,
  Videocamera,
  MapPoint,
  Database,
  Gift,
} from "@solar-icons/react";
import type { GuestbookEntryItem } from "@/lib/queries/guestbookEntries";
import type { ProofFiles } from "@/lib/validations/guestbook";
import { resolveGuestbookPhotoUrl } from "./photo-url";

interface GuestbookDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: GuestbookEntryItem | null;
  allEntries: GuestbookEntryItem[];
}

const VISIT_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  deal: { label: "Deal", className: "bg-green-100 text-green-700 border-0" },
  in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-700 border-0" },
  pending: { label: "Pending", className: "bg-gray-100 text-gray-700 border-0" },
  to_be_discuss: { label: "To Be Discuss", className: "bg-yellow-100 text-yellow-700 border-0" },
  lost: { label: "Lost", className: "bg-red-100 text-red-700 border-0" },
};

const INTERACTION_TYPE_LABELS: Record<string, string> = {
  client_visit: "Kunjungan Client",
  online_meeting: "Online Meeting",
  jemput_bola: "Jemput Bola",
};

const ONLINE_MEDIUM_LABELS: Record<string, string> = {
  zoom: "Zoom",
  google_meet: "Google Meet",
  whatsapp_call: "WhatsApp Call",
  microsoft_teams: "Microsoft Teams",
  other: "Lainnya",
};

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

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
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
  const proofFiles = (entry.proofFiles ?? null) as ProofFiles | null;
  const visitorPhoto = resolveGuestbookPhotoUrl(entry.visitorPhoto);
  const proofChat = resolveGuestbookPhotoUrl(proofFiles?.chat?.path);
  const proofPhoto = resolveGuestbookPhotoUrl(proofFiles?.photo?.path);
  const proofLost = resolveGuestbookPhotoUrl(proofFiles?.lost?.path);
  const proofReschedule = resolveGuestbookPhotoUrl(proofFiles?.reschedule?.path);

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
              <User weight="BoldDuotone" className="h-7 w-7 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-lg font-heading font-bold text-foreground truncate">
              {entry.visitorName}
            </h3>
            {entry.guestCode && (
              <p className="text-xs text-muted-foreground font-mono">{entry.guestCode}</p>
            )}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {isActive ? (
                <Badge className="rounded-full text-xs bg-green-100 text-green-700 border-0">
                  Masih di Lokasi
                </Badge>
              ) : (
                <Badge variant="secondary" className="rounded-full text-xs">
                  Selesai
                </Badge>
              )}
              {entry.sourceOfInformation?.name && (
                <Badge variant="secondary" className="rounded-full text-xs">
                  {entry.sourceOfInformation.name}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <Separator />

        {/* Photos section */}
        {visitorPhoto && (
          <div className="bg-muted/30 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Foto</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Foto Tamu</p>
                {visitorPhoto ? (
                  <Image src={visitorPhoto} alt="Foto tamu" width={300} height={200} className="rounded-xl object-cover w-full aspect-[4/3] cursor-pointer hover:opacity-80 transition-opacity" unoptimized onClick={() => setOverlayImage(visitorPhoto)} />
                ) : (
                  <div className="rounded-xl bg-secondary flex items-center justify-center w-full aspect-[4/3]">
                    <User weight="BoldDuotone" className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Proof photos */}
        {(proofPhoto || proofChat || proofLost || proofReschedule) && (
          <div className="bg-muted/30 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bukti</p>
            <div className="grid grid-cols-2 gap-3">
              {proofPhoto && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Bukti Visit</p>
                  <Image src={proofPhoto} alt="Bukti Visit" width={300} height={200} className="rounded-xl object-cover w-full aspect-[4/3] cursor-pointer hover:opacity-80 transition-opacity" unoptimized onClick={() => setOverlayImage(proofPhoto)} />
                </div>
              )}
              {proofChat && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Bukti Chat</p>
                  <Image src={proofChat} alt="Bukti Chat" width={300} height={200} className="rounded-xl object-cover w-full aspect-[4/3] cursor-pointer hover:opacity-80 transition-opacity" unoptimized onClick={() => setOverlayImage(proofChat)} />
                </div>
              )}
              {proofLost && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Bukti Lost</p>
                  <Image src={proofLost} alt="Bukti Lost" width={300} height={200} className="rounded-xl object-cover w-full aspect-[4/3] cursor-pointer hover:opacity-80 transition-opacity" unoptimized onClick={() => setOverlayImage(proofLost)} />
                </div>
              )}
              {proofReschedule && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Bukti Reschedule</p>
                  <Image src={proofReschedule} alt="Bukti Reschedule" width={300} height={200} className="rounded-xl object-cover w-full aspect-[4/3] cursor-pointer hover:opacity-80 transition-opacity" unoptimized onClick={() => setOverlayImage(proofReschedule)} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Visit info */}
        <div className="bg-muted/30 rounded-2xl p-4 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Informasi Kunjungan</p>
          {entry.interactionType && (
            <InfoRow
              icon={<ClipboardText weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />}
              label="Tipe Interaksi"
              value={
                <Badge variant="secondary" className="rounded-full text-xs font-medium">
                  {INTERACTION_TYPE_LABELS[entry.interactionType] ?? entry.interactionType}
                </Badge>
              }
            />
          )}
          {entry.sourceOfInformation?.name && (
            <InfoRow
              icon={<Database weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />}
              label="Sumber"
              value={entry.sourceOfInformation.name}
            />
          )}
          <InfoRow
            icon={<Videocamera weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />}
            label="Medium"
            value={entry.onlineMedium ? (ONLINE_MEDIUM_LABELS[entry.onlineMedium] ?? entry.onlineMedium) : null}
          />
          <InfoRow
            icon={<Videocamera weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />}
            label="Link Meeting"
            value={
              entry.meetingUrl ? (
                <a href={entry.meetingUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">
                  {entry.meetingUrl}
                </a>
              ) : null
            }
          />
          <InfoRow icon={<Buildings3 weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />} label="Venue" value={entry.venue?.name} />
          {entry.package && (
            <InfoRow
              icon={<Gift weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />}
              label="Paket"
              value={`${entry.package.packageName}${entry.package.pax ? ` (${entry.package.pax} pax)` : ""}`}
            />
          )}
          <InfoRow icon={<MapPoint weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />} label="Lokasi" value={entry.meetingLocation} />
          <InfoRow icon={<Calendar weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />} label="Jadwal" value={entry.scheduledAt ? formatDateTime(entry.scheduledAt) : null} />
          <InfoRow icon={<User weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />} label="Bertemu" value={entry.host?.fullName} />
          {entry.bitrixSourceInfo && (
            <InfoRow icon={<Database weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />} label="Sumber Bitrix" value={entry.bitrixSourceInfo} />
          )}
        </div>


        {/* Komitmen */}
        {(entry.commitVisitDate || entry.commitPayDate) && (
          <div className="bg-muted/30 rounded-2xl p-4 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Komitmen</p>
            {entry.commitVisitDate && (
              <InfoRow icon={<Calendar weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />} label="Tanggal Commit Visit" value={formatDate(entry.commitVisitDate)} />
            )}
            {entry.commitPayDate && (
              <InfoRow icon={<Calendar weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />} label="Tanggal Commit Bayar" value={formatDate(entry.commitPayDate)} />
            )}
          </div>
        )}

        {/* Contact info */}
        {(entry.email || entry.phoneNumber) && (
          <div className="bg-muted/30 rounded-2xl p-4 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kontak</p>
            <InfoRow icon={<Letter weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />} label="Email" value={entry.email} />
            <InfoRow icon={<Phone weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />} label="Telepon" value={entry.phoneNumber} />
          </div>
        )}

        {/* Notes */}
        {entry.notes && (
          <div className="bg-muted/30 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Catatan</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{entry.notes}</p>
          </div>
        )}

        {/* Visit status */}
        <div className="bg-muted/30 rounded-2xl p-4 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</p>
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
          {entry.createdBy && <p>Dicatat oleh: {entry.createdBy.fullName ?? "—"}</p>}
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
