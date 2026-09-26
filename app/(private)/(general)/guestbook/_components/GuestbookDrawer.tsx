"use client";

import { useState, useEffect, useRef, type ForwardRefExoticComponent, type RefAttributes } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import type { DateRange } from "react-day-picker";
import { id as idLocale } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AddCircle,
  Camera,
  Gallery,
  CloseCircle,
  Pen,
  ChatRoundDots,
  User,
  MapPoint,
  UsersGroupRounded,
  CalendarMark,
  type IconProps,
} from "@solar-icons/react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { BitrixIdField } from "@/components/shared/BitrixIdField";
import { PhoneInput } from "@/components/shared/PhoneInput";
import { normalizePhoneId } from "@/lib/phone";
import { cn, formatRupiah } from "@/lib/utils";
import { computeFullPrice } from "@/lib/package-prices";
import { toast } from "sonner";
import { useCreateGuestbookEntry, useUpdateGuestbookEntry, useRefreshGuestbookAdsUrl } from "@/hooks/use-guestbook";
import { useVenues } from "@/hooks/use-venues";
import { useSalesUsers } from "@/hooks/use-sales-users";
import { usePermissions } from "@/hooks/use-permissions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { createSourceOfInformation } from "@/actions/source-of-information";
import { createFestival } from "@/actions/festival";
import { createDailyActivitySegment } from "@/actions/daily-activity-segment";
import type { GuestbookEntryItem } from "@/lib/queries/guestbookEntries";
import { isBitrixSourceName, type FileDescriptor, type ProofFiles } from "@/lib/validations/guestbook";
import { resolveGuestbookPhotoUrl } from "./photo-url";

function formatDateForInput(value: string | Date | null | undefined): string {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

// checkInAt/checkOutAt/commit dates are stored as naive local wall-clock values anchored to
// UTC on the server (see parseLocalDateTime in actions/guestbook.ts) — reading them back with
// UTC getters here keeps the typed numbers stable across server/browser timezone, avoiding drift.
function formatDateTimeForInput(value: string | Date | null | undefined): string {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch error ${res.status}`);
  return res.json() as Promise<T>;
}

type SourceOption = { id: string; name: string; createdAt: string };
type FestivalOption = { id: string; name: string; createdAt: string };
type PackageOption = {
  id: string;
  packageName: string;
  pax: number;
  sellingPrice: number;
  margin: number;
  // basePrice datang sebagai string (Prisma Decimal di-serialize) atau number
  categoryPrices?: { basePrice: number | string }[];
};

interface GuestbookDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editEntry?: GuestbookEntryItem | null;
}

type PhotoFieldKey =
  | "proofChatFile"
  | "proofPhotoFile"
  | "proofLostFile"
  | "proofRescheduleFile";
type PreviewFieldKey =
  | "proofChatPreview"
  | "proofPhotoPreview"
  | "proofLostPreview"
  | "proofReschedulePreview";

type GuestbookForm = {
  visitorName: string;
  companyName: string;
  email: string;
  phoneNumber: string;
  venueId: string;
  interactionType: string;
  onlineMedium: string;
  meetingUrl: string;
  meetingLocation: string;
  scheduledAt: string;
  hostId: string;
  notes: string;
  visitStatus: string;
  sourceOfInformationId: string;
  festivalId: string;
  packageId: string;
  segmentId: string;
  eventCategory: string;
  checkInAt: string;
  checkOutAt: string;
  commitVisitDate: string;
  commitPayDate: string;
  proofChatFile: File | null;
  proofChatPreview: string;
  proofPhotoFile: File | null;
  proofPhotoPreview: string;
  proofLostFile: File | null;
  proofLostPreview: string;
  proofRescheduleFile: File | null;
  proofReschedulePreview: string;
  bitrixContactId: string;
  bitrixName: string;
  bitrixSourceInfo: string;
  bitrixAdsUrl: string;
};

const EMPTY_FORM: GuestbookForm = {
  visitorName: "",
  companyName: "",
  email: "",
  phoneNumber: "",
  venueId: "",
  interactionType: "",
  onlineMedium: "",
  meetingUrl: "",
  meetingLocation: "",
  scheduledAt: "",
  hostId: "",
  notes: "",
  visitStatus: "cold",
  sourceOfInformationId: "",
  festivalId: "",
  packageId: "",
  segmentId: "",
  eventCategory: "",
  checkInAt: "",
  checkOutAt: "",
  commitVisitDate: "",
  commitPayDate: "",
  proofChatFile: null,
  proofChatPreview: "",
  proofPhotoFile: null,
  proofPhotoPreview: "",
  proofLostFile: null,
  proofLostPreview: "",
  proofRescheduleFile: null,
  proofReschedulePreview: "",
  bitrixContactId: "",
  bitrixName: "",
  bitrixSourceInfo: "",
  bitrixAdsUrl: "",
};

const INTERACTION_TYPE_OPTIONS = [
  { value: "client_visit", label: "Kunjungan Client" },
  { value: "online_meeting", label: "Online Meeting" },
  { value: "jemput_bola", label: "Jemput Bola" },
] as const;

const ONLINE_MEDIUM_OPTIONS = [
  { value: "zoom", label: "Zoom" },
  { value: "google_meet", label: "Google Meet" },
  { value: "whatsapp_call", label: "WhatsApp Call" },
  { value: "microsoft_teams", label: "Microsoft Teams" },
  { value: "other", label: "Lainnya" },
] as const;

function SectionHeader({
  icon: Icon,
  title,
  required,
}: {
  icon: ForwardRefExoticComponent<Omit<IconProps, "ref"> & RefAttributes<SVGSVGElement>>;
  title: string;
  required?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 pb-1 border-b border-border">
      <Icon weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </span>
      {required && <span className="text-xs font-semibold text-destructive">*</span>}
    </div>
  );
}

/** Full-screen rear-camera capture, portaled to <body> so it escapes the drawer's transform. */
function CameraCapture({
  onCapture,
  onClose,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Kamera tidak didukung di perangkat atau browser ini.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setError("Akses kamera ditolak. Izinkan kamera lalu coba lagi.");
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setError("Kamera belakang tidak ditemukan di perangkat ini.");
        } else {
          setError("Gagal membuka kamera.");
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  function handleShutter() {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error("Gagal mengambil foto. Coba lagi.");
          return;
        }
        onCapture(new File([blob], `foto-tamu-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9
    );
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-black text-white">
      <div className="flex items-center justify-between p-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup kamera"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
        >
          <CloseCircle weight="BoldDuotone" className="h-6 w-6" />
        </button>
        <span className="text-sm font-medium">Ambil Foto Tamu</span>
        <span className="h-10 w-10" aria-hidden />
      </div>

      <div className="relative flex-1 overflow-hidden">
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <Camera weight="BoldDuotone" className="h-10 w-10 opacity-60" />
            <p className="max-w-xs text-sm text-white/80">{error}</p>
            <Button type="button" variant="secondary" className="rounded-full" onClick={onClose}>
              Tutup
            </Button>
          </div>
        ) : (
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        )}
      </div>

      {!error && (
        <div className="flex items-center justify-center p-6">
          <button
            type="button"
            onClick={handleShutter}
            disabled={!ready}
            aria-label="Ambil foto"
            className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white/70 bg-white/20 backdrop-blur transition-transform active:scale-95 disabled:opacity-40"
          >
            <span className="h-12 w-12 rounded-full bg-white" />
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}

function PhotoUpload({
  label,
  required,
  preview,
  fullWidth,
  withCamera,
  onFileChange,
  onClear,
}: {
  label: string;
  required?: boolean;
  preview: string;
  fullWidth?: boolean;
  withCamera?: boolean;
  onFileChange: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  function openGallery() {
    setChoiceOpen(false);
    inputRef.current?.click();
  }

  function handleTileClick() {
    if (withCamera) {
      setChoiceOpen(true);
    } else {
      inputRef.current?.click();
    }
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div className={cn("flex items-center gap-3", fullWidth && "w-full")}>
        {preview ? (
          <div className={cn("relative", fullWidth && "w-full")}>
            <Image
              src={preview}
              alt={label}
              width={fullWidth ? 400 : 80}
              height={fullWidth ? 160 : 80}
              className={cn(
                "rounded-xl object-cover border",
                fullWidth ? "h-36 w-full" : "h-20 w-20"
              )}
              unoptimized
            />
            <button
              type="button"
              className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs"
              onClick={onClear}
            >
              ×
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleTileClick}
            className={cn(
              "flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors",
              fullWidth ? "h-28 w-full" : "h-20 w-20"
            )}
          >
            <Camera weight="BoldDuotone" className="h-5 w-5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground mt-0.5">
              {withCamera ? "Tambah" : "Upload"}
            </span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFileChange(f);
          e.target.value = "";
        }}
      />

      {withCamera && (
        <Dialog open={choiceOpen} onOpenChange={setChoiceOpen}>
          <DialogContent className="rounded-2xl sm:max-w-xs">
            <DialogHeader>
              <DialogTitle>{label}</DialogTitle>
              <DialogDescription>Pilih cara menambahkan foto.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={openGallery}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Gallery weight="BoldDuotone" className="h-7 w-7 text-primary" />
                <span className="text-xs font-medium">Galeri</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setChoiceOpen(false);
                  setCameraOpen(true);
                }}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Camera weight="BoldDuotone" className="h-7 w-7 text-primary" />
                <span className="text-xs font-medium">Ambil Foto</span>
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {cameraOpen && (
        <CameraCapture
          onCapture={(file) => {
            setCameraOpen(false);
            onFileChange(file);
          }}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </div>
  );
}

export function GuestbookDrawer({ isOpen, onClose, editEntry }: GuestbookDrawerProps) {
  const [form, setForm] = useState<GuestbookForm>(EMPTY_FORM);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [doneVisitDialogOpen, setDoneVisitDialogOpen] = useState(false);
  const [checklistVisited, setChecklistVisited] = useState(false);
  const [checklistProofFilled, setChecklistProofFilled] = useState(false);
  const [festivalDraft, setFestivalDraft] = useState<{ name: string; range: DateRange | undefined } | null>(null);
  const [isCreatingFestival, setIsCreatingFestival] = useState(false);
  // Guard sinkron anti double-submit: setState nunggu re-render, ref langsung
  // ke-set — jadi klik kedua yang datang sebelum render berikutnya tetap ke-block.
  const submittingRef = useRef(false);

  const isEditMode = editEntry != null;
  const createMutation = useCreateGuestbookEntry();
  const updateMutation = useUpdateGuestbookEntry();
  const refreshAdsUrlMutation = useRefreshGuestbookAdsUrl();
  const isSaving = createMutation.isPending || updateMutation.isPending || isSubmitting;
  const { data: venues = [] } = useVenues();
  const { users: salesUsers } = useSalesUsers();
  const salesOptions = salesUsers.map((u) => ({ id: u.id, name: u.fullName ?? u.id }));
  const { can } = usePermissions();
  const { user: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();

  // Sales PIC lock — kalau yang create sales, hostId dikunci ke dirinya sendiri.
  const isSalesRole =
    currentUser?.roleName === "sales" || currentUser?.roleName === "sales-mice";
  const isSelfAssignableSales =
    isSalesRole &&
    !!currentUser?.profileId &&
    salesUsers.some((u) => u.id === currentUser.profileId);

  useEffect(() => {
    if (!isOpen || isEditMode || !isSelfAssignableSales || !currentUser?.profileId) return;
    queueMicrotask(() => {
      setForm((prev) =>
        prev.hostId === currentUser.profileId
          ? prev
          : { ...prev, hostId: currentUser.profileId! }
      );
    });
  }, [isOpen, isEditMode, isSelfAssignableSales, currentUser?.profileId]);

  const canWedding = can("booking", "view");
  const canMice = can("booking-mice", "view");

  useEffect(() => {
    if (form.eventCategory) return;
    if (canWedding && !canMice) {
      queueMicrotask(() => setForm((prev) => ({ ...prev, eventCategory: "WEDDINGS" })));
    } else if (canMice && !canWedding) {
      queueMicrotask(() => setForm((prev) => ({ ...prev, eventCategory: "MICE" })));
    }
  }, [canWedding, canMice, form.eventCategory]);

  const { data: sourceOptions = [] } = useQuery({
    queryKey: ["source-of-informations"],
    queryFn: () => fetchJson<SourceOption[]>("/api/source-of-informations"),
    staleTime: 5 * 60_000,
  });

  const { data: festivalOptions = [] } = useQuery({
    queryKey: ["festivals"],
    queryFn: () => fetchJson<FestivalOption[]>("/api/festivals"),
    staleTime: 5 * 60_000,
  });

  const { data: segmentOptions = [] } = useQuery({
    queryKey: ["daily-activity-segments"],
    queryFn: () => fetchJson<{ id: string; name: string }[]>("/api/daily-activity-segments"),
    staleTime: 5 * 60_000,
  });

  const selectedVenueId = form.venueId;
  const selectedCategory = form.eventCategory || "WEDDINGS";
  const { data: packages = [] } = useQuery({
    queryKey: ["packages", selectedVenueId, selectedCategory],
    queryFn: () =>
      fetchJson<PackageOption[]>(
        `/api/packages?venueId=${selectedVenueId}&forBooking=true&category=${selectedCategory}`
      ),
    enabled: !!selectedVenueId && !!form.eventCategory,
    staleTime: 5 * 60_000,
  });

  const isBitrixSource = isBitrixSourceName(
    sourceOptions.find((o) => o.id === form.sourceOfInformationId)?.name
  );

  useEffect(() => {
    if (!isEditMode || !isOpen) return;
    const proofFiles = (editEntry.proofFiles ?? null) as ProofFiles | null;
    queueMicrotask(() => {
      setForm({
        visitorName: editEntry.visitorName ?? "",
        companyName: editEntry.companyName ?? "",
        email: editEntry.email ?? "",
        phoneNumber: editEntry.phoneNumber ?? "",
        venueId: editEntry.venueId ?? "",
        interactionType: editEntry.interactionType ?? "",
        onlineMedium: editEntry.onlineMedium ?? "",
        meetingUrl: editEntry.meetingUrl ?? "",
        meetingLocation: editEntry.meetingLocation ?? "",
        scheduledAt: formatDateTimeForInput(editEntry.scheduledAt),
        hostId: editEntry.host?.id ?? "",
        notes: editEntry.notes ?? "",
        visitStatus: editEntry.visitStatus ?? "",
        sourceOfInformationId: editEntry.sourceOfInformationId ?? "",
        festivalId: editEntry.festivalId ?? "",
        packageId: editEntry.packageId ?? "",
        segmentId: editEntry.segmentId ?? "",
        eventCategory: editEntry.eventCategory ?? editEntry.package?.category ?? (canWedding ? "WEDDINGS" : "MICE"),
        checkInAt: formatDateTimeForInput(editEntry.checkInAt),
        checkOutAt: formatDateTimeForInput(editEntry.checkOutAt),
        commitVisitDate: formatDateForInput(editEntry.commitVisitDate),
        commitPayDate: formatDateForInput(editEntry.commitPayDate),
        proofChatFile: null,
        proofChatPreview: resolveGuestbookPhotoUrl(proofFiles?.chat?.path) ?? "",
        proofPhotoFile: null,
        proofPhotoPreview: resolveGuestbookPhotoUrl(proofFiles?.photo?.path) ?? "",
        proofLostFile: null,
        proofLostPreview: resolveGuestbookPhotoUrl(proofFiles?.lost?.path) ?? "",
        proofRescheduleFile: null,
        proofReschedulePreview: resolveGuestbookPhotoUrl(proofFiles?.reschedule?.path) ?? "",
        bitrixContactId: editEntry.bitrixContactId ?? "",
        bitrixName: editEntry.bitrixName ?? "",
        bitrixSourceInfo: editEntry.bitrixSourceInfo ?? "",
        bitrixAdsUrl: editEntry.bitrixAdsUrl ?? "",
      });
    });
  }, [isOpen, isEditMode, editEntry, canWedding]);

  // Backfill gap fix: entries with a Bitrix deal linked before this auto-refresh
  // existed (or created via manual-ID fallback) never got bitrixAdsUrl fetched.
  // Re-fetch it silently whenever such an entry's edit drawer is opened.
  useEffect(() => {
    if (!isOpen || !isEditMode || !editEntry) return;
    if (!editEntry.bitrixContactId?.trim() || editEntry.bitrixAdsUrl?.trim()) return;

    refreshAdsUrlMutation.mutate(editEntry.id, {
      onSuccess: (result) => {
        if (result.success && result.adsUrl) setField("bitrixAdsUrl", result.adsUrl);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isEditMode, editEntry?.id, editEntry?.bitrixContactId, editEntry?.bitrixAdsUrl]);

  function handleClose() {
    setForm(EMPTY_FORM);
    setShowConfirm(false);
    onClose();
  }

  function setField<K extends keyof GuestbookForm>(key: K, value: GuestbookForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Manual "Done Visit" selection has no QR check-in proof, so gate it behind a
  // light confirmation checklist. Re-selecting the same value (or picking any
  // other status) keeps the direct setField behavior — no dialog needed.
  function handleVisitStatusChange(value: string) {
    if (value === "done_visit" && form.visitStatus !== "done_visit") {
      setChecklistVisited(false);
      setChecklistProofFilled(false);
      setDoneVisitDialogOpen(true);
      return;
    }
    setField("visitStatus", value);
  }

  function confirmDoneVisit() {
    setField("visitStatus", "done_visit");
    setDoneVisitDialogOpen(false);
    setChecklistVisited(false);
    setChecklistProofFilled(false);
  }

  function cancelDoneVisitDialog() {
    setDoneVisitDialogOpen(false);
    setChecklistVisited(false);
    setChecklistProofFilled(false);
  }

  async function handleCreateFestival() {
    if (!festivalDraft?.range?.from || !festivalDraft.range.to) return;
    setIsCreatingFestival(true);
    try {
      const res = await createFestival({
        name: festivalDraft.name,
        startDate: festivalDraft.range.from,
        endDate: festivalDraft.range.to,
      });
      if (!res.success) {
        toast.error(res.error ?? "Gagal menambah festival");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["festivals"] });
      if (res.item) setField("festivalId", res.item.id);
      toast.success(`Festival "${festivalDraft.name}" berhasil ditambahkan`);
      setFestivalDraft(null);
    } finally {
      setIsCreatingFestival(false);
    }
  }

  function setInteractionType(value: string) {
    setForm((prev) => ({
      ...prev,
      interactionType: value,
      onlineMedium: "",
      meetingUrl: "",
      meetingLocation: "",
      scheduledAt: "",
    }));
  }

  function handlePhotoChange(field: PhotoFieldKey, previewField: PreviewFieldKey, file: File | null) {
    if (!file) {
      setForm((prev) => ({ ...prev, [field]: null, [previewField]: "" }));
      return;
    }
    const url = URL.createObjectURL(file);
    setForm((prev) => ({ ...prev, [field]: file, [previewField]: url }));
  }

  async function uploadPhoto(file: File): Promise<FileDescriptor | null> {
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/guestbook/upload", { method: "POST", body: fd });
      const data = (await res.json().catch(() => null)) as {
        id?: string;
        name_file_origin?: string;
        mimetype?: string;
        path?: string;
        error?: string;
      } | null;
      if (!res.ok) {
        const msg = data?.error ?? `Upload gagal (HTTP ${res.status})`;
        toast.error(msg);
        console.error("[uploadPhoto]", res.status, data);
        return null;
      }
      if (!data?.id || !data?.path) {
        toast.error("Respons upload tidak valid.");
        return null;
      }
      return {
        id: data.id,
        name_file_origin: data.name_file_origin ?? null,
        mimetype: data.mimetype ?? null,
        path: data.path,
      };
    } catch (err) {
      console.error("[uploadPhoto] network error", err);
      toast.error("Gagal mengupload foto. Periksa koneksi atau konfigurasi storage.");
      return null;
    }
  }

  function validateForm(): boolean {
    if (!form.visitorName.trim()) {
      toast.error("Nama tamu wajib diisi");
      return false;
    }
    if (!form.interactionType) {
      toast.error("Pilih tipe interaksi");
      return false;
    }
    if (!form.notes.trim()) {
      toast.error("Catatan wajib diisi");
      return false;
    }
    if (!form.checkInAt) {
      toast.error("Tanggal berkunjung wajib diisi");
      return false;
    }
    if (!form.sourceOfInformationId) {
      toast.error("Sumber wajib dipilih");
      return false;
    }
    if (!form.hostId) {
      toast.error("Sales PIC wajib dipilih");
      return false;
    }
    if (form.eventCategory === "MICE" && !form.segmentId) {
      toast.error("Segmen wajib dipilih");
      return false;
    }
    if (form.eventCategory !== "MICE" && !form.packageId) {
      toast.error("Paket wajib dipilih");
      return false;
    }
    if (isBitrixSource && !form.bitrixContactId.trim()) {
      toast.error("Bitrix ID wajib dipilih");
      return false;
    }
    if (!form.phoneNumber.trim()) {
      toast.error("No. Telepon wajib diisi");
      return false;
    }
    if (form.interactionType === "online_meeting") {
      if (!form.onlineMedium) { toast.error("Pilih medium online meeting"); return false; }
      if (form.onlineMedium !== "whatsapp_call" && !form.meetingUrl.trim()) { toast.error("Link meeting wajib diisi"); return false; }
    }
    if (form.interactionType === "jemput_bola" && !form.meetingLocation.trim()) {
      toast.error("Lokasi kunjungan wajib diisi");
      return false;
    }
    if (form.interactionType === "client_visit" && !form.venueId) {
      toast.error("Pilih venue");
      return false;
    }
    if (!isEditMode && !form.proofChatFile && !form.proofChatPreview) {
      toast.error("Bukti chat wajib diupload");
      return false;
    }
    return true;
  }

  async function handleSubmit() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setShowConfirm(false);

    try {
    async function resolveDescriptor(
      file: File | null,
      existingPreview: string,
      existing: FileDescriptor | null | undefined
    ): Promise<FileDescriptor | null> {
      if (file) return uploadPhoto(file);
      if (isEditMode && existingPreview) return existing ?? null;
      return null;
    }

    const proofFilesData = (editEntry?.proofFiles ?? null) as ProofFiles | null;
    const proofChat = await resolveDescriptor(form.proofChatFile, form.proofChatPreview, proofFilesData?.chat);
    if (form.proofChatFile && !proofChat) return;
    const proofPhoto = await resolveDescriptor(form.proofPhotoFile, form.proofPhotoPreview, proofFilesData?.photo);
    if (form.proofPhotoFile && !proofPhoto) return;
    const proofLost = await resolveDescriptor(form.proofLostFile, form.proofLostPreview, proofFilesData?.lost);
    if (form.proofLostFile && !proofLost) return;
    const proofReschedule = await resolveDescriptor(form.proofRescheduleFile, form.proofReschedulePreview, proofFilesData?.reschedule);
    if (form.proofRescheduleFile && !proofReschedule) return;

    const payload = {
      visitorName: form.visitorName.trim(),
      companyName: form.eventCategory === "MICE" ? (form.companyName.trim() || null) : null,
      eventCategory: form.eventCategory || null,
      email: form.email.trim() || null,
      phoneNumber: form.phoneNumber.trim() || null,
      venueId: form.venueId || null,
      interactionType: form.interactionType,
      onlineMedium: form.onlineMedium || null,
      meetingUrl: form.meetingUrl.trim() || null,
      meetingLocation: form.meetingLocation.trim() || null,
      scheduledAt: form.scheduledAt || null,
      hostId: form.hostId || null,
      notes: form.notes.trim() || null,
      visitStatus: form.visitStatus || null,
      sourceOfInformationId: form.sourceOfInformationId || null,
      festivalId: form.festivalId || null,
      packageId: form.packageId || null,
      segmentId: form.segmentId || null,
      checkInAt: form.checkInAt || null,
      checkOutAt: form.checkOutAt || null,
      proofFiles: {
        ...(proofPhoto ? { photo: proofPhoto } : {}),
        ...(proofChat ? { chat: proofChat } : {}),
        ...(proofLost ? { lost: proofLost } : {}),
        ...(proofReschedule ? { reschedule: proofReschedule } : {}),
      },
      commitVisitDate: form.commitVisitDate || null,
      commitPayDate: form.commitPayDate || null,
      bitrixContactId: form.bitrixContactId || null,
      bitrixName: form.bitrixName || null,
      bitrixSourceInfo: form.bitrixSourceInfo || null,
      bitrixAdsUrl: form.bitrixAdsUrl || null,
    };

    if (isEditMode) {
      const result = await updateMutation.mutateAsync({ id: editEntry!.id, data: payload });
      if (result.success) {
        toast.success("Data berhasil diperbarui");
        handleClose();
      } else {
        toast.error(result.error ?? "Gagal memperbarui data");
      }
    } else {
      const result = await createMutation.mutateAsync(payload);
      if (result.success) {
        toast.success("Tamu berhasil dicatat");
        handleClose();
      } else {
        toast.error(result.error ?? "Gagal mencatat tamu");
      }
    }
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  function handleSubmitClick() {
    if (!validateForm()) return;
    setShowConfirm(true);
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditMode ? "Edit Data Tamu" : "Tambah Tamu"}
      maxWidth="sm:max-w-lg"
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto space-y-4 pb-2">
          {/* Section: Jenis Interaksi */}
          <div className="rounded-2xl border bg-card p-5 flex flex-col gap-4">
            <SectionHeader icon={ChatRoundDots} title="Jenis Interaksi" required />
            <div className="grid grid-cols-3 gap-2">
              {INTERACTION_TYPE_OPTIONS.map((opt) => {
                const active = form.interactionType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setInteractionType(opt.value)}
                    className={cn(
                      "flex items-center justify-center gap-2 min-h-11 rounded-full px-3 py-2.5 text-xs font-semibold leading-tight text-center transition-colors",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                        active ? "border-primary-foreground" : "border-muted-foreground/40"
                      )}
                    >
                      {active && <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
                    </span>
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Kategori Event (Wedding/MICE) — muncul kalau user punya akses wedding & mice */}
            {canWedding && canMice && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Kategori Event</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "WEDDINGS", label: "Wedding" },
                    { value: "MICE", label: "MICE" },
                  ].map((opt) => {
                    const active = form.eventCategory === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setField("eventCategory", opt.value);
                          setField("packageId", "");
                          if (opt.value !== "MICE") setField("segmentId", "");
                        }}
                        className={cn(
                          "flex items-center justify-center gap-2 min-h-11 rounded-full px-3 py-2.5 text-xs font-semibold leading-tight text-center transition-colors",
                          active
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                            active ? "border-primary-foreground" : "border-muted-foreground/40"
                          )}
                        >
                          {active && <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
                        </span>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Section: Data Client */}
          <div className="rounded-2xl border bg-card p-5 flex flex-col gap-4">
            <SectionHeader icon={User} title="Data Client" />

            {canMice && form.eventCategory === "MICE" && (
              <div className="space-y-1.5">
                <Label htmlFor="gb-companyName" className="text-sm font-medium">
                  Company / Institusi
                </Label>
                <Input
                  id="gb-companyName"
                  placeholder="Nama perusahaan atau institusi"
                  value={form.companyName}
                  onChange={(e) => setField("companyName", e.target.value)}
                  className="rounded-xl"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="gb-visitorName" className="text-sm font-medium">
                Nama Client <span className="text-destructive">*</span>
              </Label>
              <Input
                id="gb-visitorName"
                placeholder="Nama lengkap client"
                value={form.visitorName}
                onChange={(e) => setField("visitorName", e.target.value)}
                className="rounded-xl"
              />
            </div>

            {form.eventCategory === "MICE" && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Segmen / Kategori <span className="text-destructive">*</span>
                </Label>
                <SearchableSelect
                  options={segmentOptions.map((o) => ({ id: o.id, name: o.name }))}
                  value={form.segmentId}
                  onChange={(v) => setField("segmentId", v)}
                  onAdd={async (name) => {
                    const res = await createDailyActivitySegment(name);
                    if (!res.success) {
                      toast.error(res.error ?? "Gagal menambah segmen");
                      return;
                    }
                    await queryClient.invalidateQueries({ queryKey: ["daily-activity-segments"] });
                    if (res.item) setField("segmentId", res.item.id);
                    toast.success(`Segmen "${name}" berhasil ditambahkan`);
                  }}
                  placeholder="Pilih segmen / kategori"
                  searchPlaceholder="Cari segmen..."
                  emptyText="Segmen tidak ditemukan"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Sumber <span className="text-destructive">*</span>
              </Label>
              <SearchableSelect
                options={sourceOptions.map((o) => ({ id: o.id, name: o.name }))}
                value={form.sourceOfInformationId}
                onChange={(v) => {
                  setField("sourceOfInformationId", v);
                }}
                onAdd={async (name) => {
                  const res = await createSourceOfInformation(name);
                  if (!res.success) {
                    toast.error(res.error ?? "Gagal menambah sumber");
                    return;
                  }
                  await queryClient.invalidateQueries({ queryKey: ["source-of-informations"] });
                  if (res.item) setField("sourceOfInformationId", res.item.id);
                  toast.success(`Sumber "${name}" berhasil ditambahkan`);
                }}
                placeholder="Pilih sumber informasi"
                searchPlaceholder="Cari sumber..."
                emptyText="Tidak ada sumber"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Festival</Label>
              <SearchableSelect
                options={festivalOptions.map((o) => ({ id: o.id, name: o.name }))}
                value={form.festivalId}
                onChange={(v) => {
                  setField("festivalId", v);
                }}
                onAdd={(name) => {
                  setFestivalDraft({ name, range: undefined });
                }}
                placeholder="Pilih festival"
                searchPlaceholder="Cari festival..."
                emptyText="Tidak ada festival"
              />
            </div>

            {isBitrixSource && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Bitrix ID <span className="text-destructive">*</span>
                </Label>
                {can("bitrix", "view") ? (
                  <>
                    <BitrixIdField
                      value={form.bitrixContactId}
                      onChange={(v, deal) => {
                        setField("bitrixContactId", v);
                        // No. telp auto-bind dari kontak Bitrix (dinormalisasi ke format
                        // simpanan <kodeNegara><nomor>); kalau kosong, biar user isi manual.
                        if (deal?.phone) {
                          const norm = normalizePhoneId(deal.phone);
                          if (norm) setField("phoneNumber", norm);
                        }
                        // Ambil URL iklan dari deal Bitrix terkait; kalau ID dikosongkan,
                        // reset field-nya.
                        if (v) {
                          void fetch(`/api/guestbook/bitrix-ads-url?dealId=${encodeURIComponent(v)}`)
                            .then((res) => res.json())
                            .then((data) => setField("bitrixAdsUrl", data.adsUrl ?? ""))
                            .catch(() => {});
                        } else {
                          setField("bitrixAdsUrl", "");
                        }
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      No. telepon terisi otomatis bila kontak Bitrix punya nomor.
                    </p>
                  </>
                ) : (
                  <>
                    <Input
                      placeholder="Masukkan Bitrix ID"
                      value={form.bitrixContactId}
                      onChange={(e) => setField("bitrixContactId", e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Anda tidak punya akses pencarian Bitrix, masukkan Bitrix ID secara manual.
                    </p>
                  </>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="gb-email" className="text-sm font-medium">Email</Label>
              <Input
                id="gb-email"
                type="email"
                placeholder="email@contoh.com"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gb-phone" className="text-sm font-medium">
                No. Telepon <span className="text-destructive">*</span>
              </Label>
              <PhoneInput
                id="gb-phone"
                value={form.phoneNumber}
                onChange={(v) => setField("phoneNumber", v)}
                wrapperClassName="rounded-xl"
              />
            </div>
          </div>

          {/* Section: Detail — selalu tampil, gak nunggu jenis interaksi dipilih */}
          <div className="rounded-2xl border bg-card p-5 flex flex-col gap-4">
            <SectionHeader icon={MapPoint} title="Detail Kunjungan" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="gb-checkInAt" className="text-sm font-medium">
                    Tanggal Berkunjung <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="gb-checkInAt"
                    type="datetime-local"
                    required
                    value={form.checkInAt}
                    onChange={(e) => setField("checkInAt", e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                {isEditMode && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="gb-checkOutAt" className="text-sm font-medium">
                      Tanggal Checkout
                    </Label>
                    <Input
                      id="gb-checkOutAt"
                      type="datetime-local"
                      value={form.checkOutAt}
                      onChange={(e) => setField("checkOutAt", e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                )}
              </div>

              {/* Venue — semua tipe interaksi */}
              <div className="space-y-1.5">
                <Label htmlFor="gb-venue" className="text-sm font-medium">
                  Venue{" "}
                  {form.interactionType === "client_visit" && <span className="text-destructive">*</span>}
                </Label>
                <Select
                  value={form.venueId}
                  onValueChange={(v) => {
                    setField("venueId", v);
                    setField("packageId", "");
                  }}
                >
                  <SelectTrigger id="gb-venue" className="rounded-xl w-full">
                    <SelectValue placeholder="Pilih venue" />
                  </SelectTrigger>
                  <SelectContent>
                    {venues.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Paket — hanya untuk Wedding; disembunyikan saat MICE */}
              {form.eventCategory !== "MICE" && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    Paket <span className="text-destructive">*</span>
                  </Label>
                  <SearchableSelect
                    options={packages.map((p) => {
                      const base = (p.categoryPrices ?? []).reduce(
                        (sum, c) => sum + Number(c.basePrice),
                        0
                      );
                      const price = computeFullPrice([{ basePrice: base }], p.margin ?? 0, p.sellingPrice);
                      const paxLabel = p.pax ? ` — ${p.pax} pax` : "";
                      const priceLabel = price > 0 ? ` — ${formatRupiah(price)}` : "";
                      return {
                        id: p.id,
                        name: `${p.packageName}${paxLabel}${priceLabel}`,
                      };
                    })}
                    value={form.packageId}
                    onChange={(v) => setField("packageId", v)}
                    placeholder={
                      !form.venueId
                        ? "Pilih venue terlebih dahulu"
                        : !form.eventCategory
                          ? "Pilih kategori event"
                          : "Pilih paket"
                    }
                    searchPlaceholder="Cari paket..."
                    emptyText="Tidak ada paket"
                    disabled={!form.venueId || !form.eventCategory}
                  />
                </div>
              )}

              {/* Detail per tipe interaksi */}
              {form.interactionType === "online_meeting" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="gb-onlineMedium" className="text-sm font-medium">
                      Medium <span className="text-destructive">*</span>
                    </Label>
                    <Select value={form.onlineMedium} onValueChange={(v) => setField("onlineMedium", v)}>
                      <SelectTrigger id="gb-onlineMedium" className="rounded-xl w-full">
                        <SelectValue placeholder="Pilih medium meeting" />
                      </SelectTrigger>
                      <SelectContent>
                        {ONLINE_MEDIUM_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="gb-meetingUrl" className="text-sm font-medium">
                      Link Meeting{" "}
                      {form.onlineMedium !== "whatsapp_call" && <span className="text-destructive">*</span>}
                    </Label>
                    <Input id="gb-meetingUrl" placeholder="https://..." value={form.meetingUrl} onChange={(e) => setField("meetingUrl", e.target.value)} className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="gb-meetingLocation-online" className="text-sm font-medium">Lokasi</Label>
                    <Input
                      id="gb-meetingLocation-online"
                      placeholder="Isi lokasi bila di luar venue"
                      value={form.meetingLocation}
                      onChange={(e) => setField("meetingLocation", e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                </>
              )}

              {form.interactionType === "jemput_bola" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="gb-meetingLocation-jemput" className="text-sm font-medium">
                      Lokasi <span className="text-destructive">*</span>
                    </Label>
                    <Input id="gb-meetingLocation-jemput" placeholder="Lokasi kunjungan" value={form.meetingLocation} onChange={(e) => setField("meetingLocation", e.target.value)} className="rounded-xl" />
                  </div>
                </>
              )}
          </div>

          {/* Section: Tindak Lanjut */}
          <div className="rounded-2xl border bg-card p-5 flex flex-col gap-4">
            <SectionHeader icon={UsersGroupRounded} title="Tindak Lanjut" />

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Sales PIC <span className="text-destructive">*</span>
              </Label>
              <SearchableSelect
                options={salesOptions}
                value={form.hostId}
                onChange={(v) => setField("hostId", v)}
                placeholder="Pilih sales yang ditemui"
                searchPlaceholder="Cari sales..."
                emptyText="Tidak ada sales"
                disabled={isSelfAssignableSales}
              />
              {isSelfAssignableSales ? (
                <p className="text-xs text-muted-foreground">Otomatis ditugaskan ke Anda.</p>
              ) : (
                <p className="text-xs text-muted-foreground">Sales PIC yang ditemui — dipakai untuk atribusi</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gb-visitStatus" className="text-sm font-medium">Status</Label>
              <Select value={form.visitStatus} onValueChange={handleVisitStatusChange}>
                <SelectTrigger id="gb-visitStatus" className="rounded-xl w-full">
                  <SelectValue placeholder="Pilih status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cold">Cold</SelectItem>
                  <SelectItem value="warm">Warm</SelectItem>
                  <SelectItem value="hot">Hot</SelectItem>
                  <SelectItem value="done_visit">Done Visit</SelectItem>
                  <SelectItem value="to_be_discuss">To Be Discuss</SelectItem>
                  <SelectItem value="deal">Deal</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gb-notes" className="text-sm font-medium">
                Catatan <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="gb-notes"
                placeholder="Catatan tambahan..."
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                className="rounded-xl min-h-20 resize-y"
              />
            </div>
          </div>

          {/* Section: Bukti */}
          <div className="rounded-2xl border bg-card p-5 flex flex-col gap-4">
            <SectionHeader icon={Camera} title="Bukti" />
            <div className="grid grid-cols-2 gap-4">
              <PhotoUpload
                label="Bukti Chat"
                required
                fullWidth
                preview={form.proofChatPreview}
                onFileChange={(f) => handlePhotoChange("proofChatFile", "proofChatPreview", f)}
                onClear={() => handlePhotoChange("proofChatFile", "proofChatPreview", null)}
              />
              <PhotoUpload
                label="Bukti Foto Visit"
                fullWidth
                withCamera
                preview={form.proofPhotoPreview}
                onFileChange={(f) => handlePhotoChange("proofPhotoFile", "proofPhotoPreview", f)}
                onClear={() => handlePhotoChange("proofPhotoFile", "proofPhotoPreview", null)}
              />
              <PhotoUpload
                label="Bukti Lost"
                fullWidth
                preview={form.proofLostPreview}
                onFileChange={(f) => handlePhotoChange("proofLostFile", "proofLostPreview", f)}
                onClear={() => handlePhotoChange("proofLostFile", "proofLostPreview", null)}
              />
              <PhotoUpload
                label="Bukti Reschedule"
                fullWidth
                preview={form.proofReschedulePreview}
                onFileChange={(f) => handlePhotoChange("proofRescheduleFile", "proofReschedulePreview", f)}
                onClear={() => handlePhotoChange("proofRescheduleFile", "proofReschedulePreview", null)}
              />
            </div>
          </div>

          {/* Section: Komitmen */}
          <div className="rounded-2xl border bg-card p-5 flex flex-col gap-4">
            <SectionHeader icon={CalendarMark} title="Komitmen" />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="gb-commitVisitDate" className="text-sm font-medium">Tanggal Commit</Label>
                <Input
                  id="gb-commitVisitDate"
                  type="date"
                  value={form.commitVisitDate}
                  onChange={(e) => setField("commitVisitDate", e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gb-commitPayDate" className="text-sm font-medium">Tanggal Commit Bayar</Label>
                <Input
                  id="gb-commitPayDate"
                  type="date"
                  value={form.commitPayDate}
                  onChange={(e) => setField("commitPayDate", e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-background border-t border-border pt-4 mt-4 flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1 rounded-full"
            onClick={handleClose}
            disabled={isSaving}
          >
            Batal
          </Button>
          <Button
            type="button"
            className="flex-1 rounded-full gap-1.5"
            onClick={handleSubmitClick}
            disabled={isSaving || !form.visitorName.trim() || !form.interactionType || !form.notes.trim()}
          >
            {isEditMode ? (
              <><Pen weight="BoldDuotone" className="h-4 w-4" />{isSaving ? "Menyimpan..." : "Simpan"}</>
            ) : (
              <><AddCircle weight="BoldDuotone" className="h-4 w-4" />{isSaving ? "Menyimpan..." : "Catat Tamu"}</>
            )}
          </Button>
        </div>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isEditMode ? "Konfirmasi Ubah Data" : "Konfirmasi Tambah Data"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isEditMode
                ? "Yakin ingin menyimpan perubahan data tamu ini?"
                : "Yakin ingin menambahkan data tamu baru?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full" disabled={isSaving}>Batal</AlertDialogCancel>
            <AlertDialogAction className="rounded-full" onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? "Menyimpan..." : isEditMode ? "Ya, Simpan" : "Ya, Tambah"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={doneVisitDialogOpen}
        onOpenChange={(open) => {
          if (!open) cancelDoneVisitDialog();
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Konfirmasi Done Visit</DialogTitle>
            <DialogDescription>
              Pastikan checklist berikut sudah terpenuhi sebelum menandai status sebagai Done Visit.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <Checkbox
                id="gb-checklist-visited"
                checked={checklistVisited}
                onCheckedChange={(checked) => setChecklistVisited(checked === true)}
              />
              <Label htmlFor="gb-checklist-visited" className="cursor-pointer text-sm font-normal">
                Tamu benar-benar sudah melakukan kunjungan
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="gb-checklist-proof"
                checked={checklistProofFilled}
                onCheckedChange={(checked) => setChecklistProofFilled(checked === true)}
              />
              <Label htmlFor="gb-checklist-proof" className="cursor-pointer text-sm font-normal">
                Bukti kunjungan (foto/chat) sudah diisi
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-full" onClick={cancelDoneVisitDialog}>
              Batal
            </Button>
            <Button
              type="button"
              className="rounded-full"
              onClick={confirmDoneVisit}
              disabled={!checklistVisited || !checklistProofFilled}
            >
              Konfirmasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!festivalDraft}
        onOpenChange={(open) => {
          if (!open) setFestivalDraft(null);
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Tambah Festival</DialogTitle>
            <DialogDescription>
              Tentukan tanggal berlangsungnya festival &quot;{festivalDraft?.name}&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center rounded-xl border border-border">
            <Calendar
              mode="range"
              numberOfMonths={1}
              selected={festivalDraft?.range}
              onSelect={(range) => setFestivalDraft((prev) => (prev ? { ...prev, range } : prev))}
              locale={idLocale}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setFestivalDraft(null)}>
              Batal
            </Button>
            <Button
              type="button"
              className="rounded-full"
              disabled={!festivalDraft?.range?.from || !festivalDraft?.range?.to || isCreatingFestival}
              onClick={handleCreateFestival}
            >
              {isCreatingFestival ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Drawer>
  );
}
