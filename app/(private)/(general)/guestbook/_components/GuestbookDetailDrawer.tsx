"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Drawer } from "@/components/shared/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Buildings,
  Buildings3,
  Letter,
  Phone,
  Calendar,
  ClipboardText,
  ConfettiMinimalistic,
  User,
  CloseCircle,
  Videocamera,
  MapPoint,
  Database,
  Gift,
  QrCode,
  CheckCircle,
  ShareCircle,
} from "@solar-icons/react";
import type { GuestbookEntryItem } from "@/lib/queries/guestbookEntries";
import type { ProofFiles } from "@/lib/validations/guestbook";
import { resolveGuestbookPhotoUrl } from "./photo-url";
import { generateGuestbookTicketBlob } from "./guestbook-ticket";

interface GuestbookDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: GuestbookEntryItem | null;
  allEntries: GuestbookEntryItem[];
}

const VISIT_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  cold: { label: "Cold", className: "bg-sky-100 text-sky-700 border-0" },
  warm: { label: "Warm", className: "bg-amber-100 text-amber-700 border-0" },
  hot: { label: "Hot", className: "bg-orange-100 text-orange-700 border-0" },
  done_visit: { label: "Done Visit", className: "bg-emerald-100 text-emerald-700 border-0" },
  to_be_discuss: { label: "To Be Discuss", className: "bg-yellow-100 text-yellow-700 border-0" },
  deal: { label: "Deal", className: "bg-green-100 text-green-700 border-0" },
  lost: { label: "Lost", className: "bg-red-100 text-red-700 border-0" },
};

const INTERACTION_TYPE_LABELS: Record<string, string> = {
  client_visit: "Kunjungan Client",
  online_meeting: "Online Meeting",
  jemput_bola: "Jemput Bola",
};

const EVENT_CATEGORY_LABELS: Record<string, string> = {
  WEDDINGS: "Wedding",
  MICE: "MICE",
};

const ONLINE_MEDIUM_LABELS: Record<string, string> = {
  zoom: "Zoom",
  google_meet: "Google Meet",
  whatsapp_call: "WhatsApp Call",
  microsoft_teams: "Microsoft Teams",
  other: "Lainnya",
};

// Used for true instants (attendanceConfirmedAt, createdAt) — browser-local display is correct here.
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

// checkInAt in visit history is a naive local wall-clock value anchored to UTC on the server —
// must read back with timeZone: "UTC" to avoid double-converting (unlike formatDateTime above).
function formatVisitDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

// commitVisitDate/commitPayDate are naive local dates anchored to UTC on the server.
function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
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
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (!entry?.guestCode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(entry.guestCode, { width: 240, margin: 1 })
      .then((dataUrl) => setQrDataUrl(dataUrl))
      .catch(() => setQrDataUrl(null));
  }, [entry?.guestCode]);

  if (!entry) return null;

  async function handleShareTicket(): Promise<void> {
    if (!entry) return;
    setIsSharing(true);
    try {
      const blob = await generateGuestbookTicketBlob(entry);
      if (!blob) {
        toast.error("Gagal membuat gambar tiket.");
        return;
      }
      const file = new File([blob], `tiket-${entry.guestCode}.png`, { type: "image/png" });
      const canShareFile =
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });

      if (canShareFile) {
        await navigator.share({
          files: [file],
          title: "Tiket Kehadiran Expo",
          text: `Tiket kehadiran expo untuk ${entry.visitorName}. Mohon konfirmasi kehadiran Anda beserta jumlah tamu yang akan hadir ya.`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `tiket-${entry.guestCode}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.info("Gambar tiket diunduh. Kirim manual lewat WhatsApp ya.");
      }
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      if (!isAbort) {
        console.error("[handleShareTicket]", err);
        toast.error("Gagal membagikan tiket.");
      }
    } finally {
      setIsSharing(false);
    }
  }

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
  const proofChat = resolveGuestbookPhotoUrl(proofFiles?.chat?.path);
  const proofPhoto = resolveGuestbookPhotoUrl(proofFiles?.photo?.path);
  const proofLost = resolveGuestbookPhotoUrl(proofFiles?.lost?.path);
  const proofReschedule = resolveGuestbookPhotoUrl(proofFiles?.reschedule?.path);
  const eventCategory = entry.eventCategory ?? entry.package?.category ?? null;

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
          <div className="h-16 w-16 rounded-2xl bg-secondary flex items-center justify-center shrink-0">
            <User weight="BoldDuotone" className="h-7 w-7 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-heading font-bold text-foreground truncate">
              {entry.visitorName}
            </h3>
            {entry.guestCode && (
              <p className="text-xs text-muted-foreground font-mono">{entry.guestCode}</p>
            )}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {entry.sourceOfInformation?.name && (
                <Badge variant="secondary" className="rounded-full text-xs">
                  {entry.sourceOfInformation.name}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <Separator />

        {/* QR Kehadiran Expo */}
        {entry.guestCode && (
          <div className="bg-muted/30 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <QrCode weight="BoldDuotone" className="h-3.5 w-3.5" />
              QR Kehadiran Expo
            </p>
            <div className="flex flex-col items-center gap-2">
              {qrDataUrl && (
                <Image
                  src={qrDataUrl}
                  alt="QR Kehadiran Expo"
                  width={200}
                  height={200}
                  className="rounded-xl bg-white p-2"
                  unoptimized
                />
              )}
              <p className="font-mono text-xs text-muted-foreground">{entry.guestCode}</p>
              {entry.attendanceConfirmedAt ? (
                <div className="flex flex-col items-center gap-1 pt-1">
                  <Badge className="rounded-full text-xs bg-emerald-100 text-emerald-700 border-0">
                    <CheckCircle weight="BoldDuotone" className="h-3.5 w-3.5 mr-1" />
                    Hadir Expo
                  </Badge>
                  <p className="text-xs text-muted-foreground text-center">
                    {formatDateTime(entry.attendanceConfirmedAt)}
                    {entry.attendanceConfirmedBy?.fullName
                      ? ` oleh ${entry.attendanceConfirmedBy.fullName}`
                      : ""}
                  </p>
                </div>
              ) : (
                <Badge variant="secondary" className="rounded-full text-xs">
                  Belum Konfirmasi Kehadiran
                </Badge>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full gap-1.5 mt-1"
                onClick={handleShareTicket}
                disabled={isSharing}
              >
                <ShareCircle weight="BoldDuotone" className="h-4 w-4" />
                {isSharing ? "Menyiapkan..." : "Bagikan ke WhatsApp"}
              </Button>
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
          {eventCategory && (
            <InfoRow
              icon={<ConfettiMinimalistic weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />}
              label="Kategori Event"
              value={
                <Badge variant="secondary" className="rounded-full text-xs font-medium">
                  {EVENT_CATEGORY_LABELS[eventCategory] ?? eventCategory}
                </Badge>
              }
            />
          )}
          <InfoRow
            icon={<Buildings weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />}
            label="Company / Institusi"
            value={entry.companyName}
          />
          {entry.sourceOfInformation?.name && (
            <InfoRow
              icon={<Database weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />}
              label="Sumber"
              value={entry.sourceOfInformation.name}
            />
          )}
          {entry.segment?.name && (
            <InfoRow
              icon={<ClipboardText weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />}
              label="Segmen / Kategori"
              value={entry.segment.name}
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
                        <p className="text-foreground font-medium">{formatVisitDateTime(past.checkInAt)}</p>
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
