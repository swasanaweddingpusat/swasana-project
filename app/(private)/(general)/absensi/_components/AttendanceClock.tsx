"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useAttendanceToday, useClockIn, useClockOut } from "@/hooks/use-attendance";
import { useWorkShifts } from "@/hooks/use-work-shifts";
import { useWorkLocations } from "@/hooks/use-work-locations";
import type { AttendanceStatusValue } from "@/lib/validations/attendance";
import { CameraModal } from "./CameraModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ClockCircle, Login3, Logout3, MapPoint, Camera, Restart } from "@solar-icons/react";

type ClockAction = "in" | "out";

const STATUS_OPTIONS: { value: AttendanceStatusValue; label: string }[] = [
  { value: "WORKDAY", label: "Work Day" },
  { value: "DAY_OFF", label: "Day Off" },
];

const WORK_TYPE_OPTIONS = [
  { value: "WFO", label: "Kerja dari Kantor (WFO)" },
  { value: "WFH", label: "Kerja dari Rumah (WFH)" },
  { value: "WFA", label: "Kerja dari Mana Saja (WFA)" },
] as const;

const WORK_TYPE_LABEL: Record<string, string> = {
  WFO: "WFO",
  WFH: "WFH",
  WFA: "WFA",
};

const WORK_TYPE_APPROVAL_BADGE: Record<string, { label: string; variant: "secondary" | "destructive" } | undefined> = {
  pending: { label: "Menunggu Persetujuan", variant: "secondary" },
  rejected: { label: "Ditolak", variant: "destructive" },
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function formatDuration(start: Date | string | null, end: Date | string | null): string {
  if (!start) return "-";
  const endDate = end ? new Date(end) : new Date();
  const minutes = Math.max(0, Math.floor((endDate.getTime() - new Date(start).getTime()) / 60000));
  return `${Math.floor(minutes / 60)}j ${String(minutes % 60).padStart(2, "0")}m`;
}

export function AttendanceClock() {
  // null on first (server + pre-hydration client) render so the clock text matches
  // exactly, then filled in client-side after mount — avoids a hydration mismatch
  // since server render time and client hydration time are never the same instant.
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<ClockAction | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatusValue | "">("");
  const [selectedIsPublicHoliday, setSelectedIsPublicHoliday] = useState(false);
  const [selectedPublicHolidayId, setSelectedPublicHolidayId] = useState<string>("");
  const [selectedShiftId, setSelectedShiftId] = useState<string>("");
  const [selectedWorkType, setSelectedWorkType] = useState<string>("");
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [workTypeReason, setWorkTypeReason] = useState<string>("");

  const { data: todayData, isLoading: todayLoading } = useAttendanceToday();
  const { data: workShifts } = useWorkShifts();
  const { data: workLocations } = useWorkLocations();
  const clockInMutation = useClockIn();
  const clockOutMutation = useClockOut();

  const attendance = todayData?.attendance ?? null;
  const context = todayData?.context ?? null;
  const shift = todayData?.shift ?? null;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe clock: must set once on mount
    setCurrentTime(new Date());
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Pre-fill status once from context (informational only — never overrides a manual pick).
  // Public holiday is a system marker (shown as a badge), not a selectable status.
  useEffect(() => {
    if (selectedStatus || !context) return;
    // one-shot prefill once async context arrives, guarded by selectedStatus above
    if (context.attendantType === "DAY_OFF") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedStatus("DAY_OFF");
    } else {
      setSelectedStatus("WORKDAY");
    }
  }, [context, selectedStatus]);

  const handleStatusChange = useCallback((value: string) => {
    setSelectedStatus(value as AttendanceStatusValue);
    if (value === "WORKDAY") {
      // Entering the workday flow — nothing off-flow to clear.
    } else {
      // Entering the off flow — clear workday-only selections, including the public
      // holiday tag (Day Off is always libur biasa; Public Holiday only applies to WORKDAY).
      setSelectedShiftId("");
      setSelectedWorkType("");
      setSelectedLocationId("");
      setSelectedIsPublicHoliday(false);
      setSelectedPublicHolidayId("");
      setWorkTypeReason("");
    }
  }, []);

  const handlePublicHolidayToggle = useCallback((checked: boolean) => {
    setSelectedIsPublicHoliday(checked);
    setSelectedPublicHolidayId(checked ? (context?.publicHolidayOptions[0]?.id ?? "") : "");
  }, [context?.publicHolidayOptions]);

  const isMutating = clockInMutation.isPending || clockOutMutation.isPending;
  const isWorkday = selectedStatus === "WORKDAY";

  const getStatusBadge = useCallback(() => {
    if (todayLoading) return <Badge variant="secondary">Memuat...</Badge>;
    if (!attendance) return <Badge variant="outline">Belum Absen</Badge>;
    if (attendance.status === "on_time") return <Badge variant="default">Tepat Waktu</Badge>;
    if (attendance.status === "late") return <Badge variant="secondary">Terlambat</Badge>;
    return <Badge variant="outline">Belum Absen</Badge>;
  }, [attendance, todayLoading]);

  // GPS is fetched best-effort in the background so it never blocks the camera from
  // opening — the workday/location fields (which need it) are only validated later,
  // at submit time in the details step below.
  const requestGps = useCallback(() => {
    setGpsLoading(true);
    if (!navigator.geolocation) {
      setGpsLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setGpsLoading(false);
      },
      () => {
        setGpsCoords(null);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  // Clock-in tap: open the camera immediately — no field is required beforehand.
  // Status/shift/work-type/location are filled AFTER the photo, in the details step.
  const handleClockInTap = useCallback(() => {
    setPendingAction("in");
    setCapturedPhoto(null);
    setGpsCoords(null);
    requestGps();
    setCameraOpen(true);
  }, [requestGps]);

  // Clock-out has no fields to fill, so it keeps the original GPS-then-camera order.
  const handleClockOutTap = useCallback(() => {
    setGpsLoading(true);
    setPendingAction("out");

    if (!navigator.geolocation) {
      toast.error("Browser Anda tidak mendukung geolocation");
      setGpsLoading(false);
      setPendingAction(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setGpsLoading(false);
        setCameraOpen(true);
      },
      () => {
        toast.error("Izin lokasi diperlukan untuk absensi");
        setGpsLoading(false);
        setPendingAction(null);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  const handleRetakePhoto = useCallback(() => {
    setCameraOpen(true);
  }, []);

  const handleCancelClockIn = useCallback(() => {
    setPendingAction(null);
    setCapturedPhoto(null);
    setGpsCoords(null);
  }, []);

  const handleCapture = useCallback((photoBase64: string) => {
    setCameraOpen(false);
    if (!pendingAction) return;

    if (pendingAction === "in") {
      // Photo captured — reveal the details step below instead of submitting right away.
      setCapturedPhoto(photoBase64);
      return;
    }

    if (!gpsCoords) return;
    clockOutMutation.mutate(
      { photoBase64, lat: gpsCoords.lat, lng: gpsCoords.lng },
      {
        onSuccess: () => {
          toast.success("Clock out berhasil!");
          setPendingAction(null);
          setGpsCoords(null);
        },
        onError: (err) => {
          toast.error(err.message);
          setPendingAction(null);
          setGpsCoords(null);
        },
      },
    );
  }, [gpsCoords, pendingAction, clockOutMutation]);

  const handleSubmitClockIn = useCallback(() => {
    if (!capturedPhoto) return;

    if (!selectedStatus) {
      toast.error("Pilih status kehadiran terlebih dahulu");
      return;
    }

    if (!isWorkday) {
      // Off flow: plain day off. Selfie only, no GPS/location needed.
      clockInMutation.mutate(
        { attendanceStatus: "DAY_OFF", photoBase64: capturedPhoto },
        {
          onSuccess: () => {
            toast.success("Absensi berhasil disimpan!");
            setPendingAction(null);
            setCapturedPhoto(null);
          },
          onError: (err) => toast.error(err.message),
        },
      );
      return;
    }

    if (!selectedShiftId) {
      toast.error("Pilih shift terlebih dahulu");
      return;
    }
    if (!selectedWorkType) {
      toast.error("Pilih tipe kerja terlebih dahulu");
      return;
    }
    if (selectedWorkType === "WFO" && !selectedLocationId) {
      toast.error("Pilih lokasi kerja terlebih dahulu");
      return;
    }
    if (selectedIsPublicHoliday && !selectedPublicHolidayId) {
      toast.error("Pilih public holiday terlebih dahulu");
      return;
    }
    if (gpsLoading) {
      toast.error("Menunggu lokasi GPS, mohon tunggu sebentar");
      return;
    }
    if (!gpsCoords) {
      toast.error("Lokasi GPS tidak tersedia. Coba lagi.");
      return;
    }

    clockInMutation.mutate(
      {
        attendanceStatus: "WORKDAY",
        photoBase64: capturedPhoto,
        lat: gpsCoords.lat,
        lng: gpsCoords.lng,
        workShiftId: selectedShiftId,
        workType: selectedWorkType as "WFO" | "WFH" | "WFA",
        workLocationId: selectedWorkType === "WFO" ? selectedLocationId : undefined,
        workTypeReason: selectedWorkType !== "WFO" ? (workTypeReason || undefined) : undefined,
        // Nama hari besar tetap ditentukan HRD (master by-date); karyawan cuma menandai.
        isPublicHoliday: selectedIsPublicHoliday,
        publicHolidayId: selectedIsPublicHoliday ? (selectedPublicHolidayId || undefined) : undefined,
      },
      {
        onSuccess: () => {
          if (selectedWorkType === "WFO") {
            toast.success("Clock in berhasil!");
          } else {
            toast.success("Clock in berhasil! Menunggu persetujuan HR untuk tipe kerja WFH/WFA.");
          }
          setPendingAction(null);
          setCapturedPhoto(null);
          setGpsCoords(null);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }, [capturedPhoto, selectedStatus, isWorkday, selectedShiftId, selectedWorkType, selectedLocationId, selectedIsPublicHoliday, selectedPublicHolidayId, workTypeReason, gpsLoading, gpsCoords, clockInMutation]);

  const handleCameraClose = useCallback(() => {
    setCameraOpen(false);
    // Only reset the whole flow if there's no photo yet (first open, user backed out).
    // If closing mid-retake, keep the previously captured photo and the details step.
    if (!capturedPhoto) {
      setPendingAction(null);
      setGpsCoords(null);
    }
  }, [capturedPhoto]);

  const canClockIn = !attendance?.clockInAt;
  const canClockOut = !!attendance?.clockInAt && !attendance?.clockOutAt;
  const isDone = !!attendance?.clockOutAt;
  const showClockInDetails = canClockIn && pendingAction === "in" && !!capturedPhoto;
  const submitClockInDisabled =
    isMutating ||
    !selectedStatus ||
    (isWorkday && !selectedShiftId) ||
    (isWorkday && !selectedWorkType) ||
    (isWorkday && selectedWorkType === "WFO" && !selectedLocationId) ||
    (isWorkday && selectedIsPublicHoliday && !selectedPublicHolidayId) ||
    (isWorkday && (gpsLoading || !gpsCoords));

  return (
    <>
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-heading text-lg">
            <ClockCircle weight="BoldDuotone" className="h-5 w-5" />
            Absensi Hari Ini
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="text-center space-y-1">
            <p className="text-2xl sm:text-3xl font-heading font-bold tabular-nums tracking-tight">
              {currentTime ? formatTime(currentTime) : "--:--:--"}
            </p>
            <p className="text-sm text-muted-foreground">{currentTime ? formatDate(currentTime) : " "}</p>
          </div>

          <div className="flex items-center justify-center gap-3">
            {getStatusBadge()}
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-muted/30 p-3 text-sm sm:grid-cols-4">
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">Jadwal</p>
              <p className="mt-0.5 truncate font-medium">
                {shift ? `${shift.startTime} - ${shift.endTime}` : "Belum ditentukan"}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">Mode kerja</p>
              <p className="mt-0.5 truncate font-medium">
                {attendance?.workType ? WORK_TYPE_LABEL[attendance.workType] : "Belum dipilih"}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">Masuk</p>
              <p className="mt-0.5 truncate font-medium">
                {attendance?.clockInAt ? formatTime(new Date(attendance.clockInAt)) : "-"}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">Durasi</p>
              <p className="mt-0.5 truncate font-medium">
                {formatDuration(attendance?.clockInAt ?? null, attendance?.clockOutAt ?? null)}
              </p>
            </div>
          </div>

          {attendance ? (
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {attendance.attendantType === "DAY_OFF" && (
                <Badge variant="secondary">Day Off</Badge>
              )}
              {attendance.isPublicHoliday && (
                <Badge variant="destructive">
                  Tanggal Merah{attendance.publicHolidayName ? ` — ${attendance.publicHolidayName}` : ""}
                </Badge>
              )}
            </div>
          ) : (
            context && (
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {context.attendantType === "DAY_OFF" && (
                  <Badge variant="secondary">Biasanya Libur</Badge>
                )}
                {context.isPublicHoliday && (
                  <Badge variant="destructive">Tanggal Merah</Badge>
                )}
              </div>
            )
          )}

          {canClockIn && pendingAction !== "in" && (
            <p className="text-center text-sm text-muted-foreground">
              Ambil foto terlebih dahulu, lalu lengkapi detail kehadiran.
            </p>
          )}

          {showClockInDetails && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-3">
                {capturedPhoto && (
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                    <Image src={capturedPhoto} alt="Foto absensi" fill unoptimized className="object-cover" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Foto absensi siap</p>
                  <p className="text-xs text-muted-foreground">Lengkapi detail di bawah, lalu simpan.</p>
                </div>
                <Button type="button" variant="outline" size="sm" className="rounded-full shrink-0" onClick={handleRetakePhoto}>
                  <Restart weight="BoldDuotone" className="h-4 w-4 mr-1.5" />
                  Ambil Ulang
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Status Kehadiran</label>
                  <Select value={selectedStatus} onValueChange={handleStatusChange}>
                    <SelectTrigger className="w-full rounded-xl">
                      <SelectValue placeholder="Pilih status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {isWorkday && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Shift</label>
                    <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                      <SelectTrigger className="w-full rounded-xl">
                        <SelectValue placeholder="Pilih shift" />
                      </SelectTrigger>
                      <SelectContent>
                        {workShifts?.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} ({s.startTime} - {s.endTime})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {isWorkday && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Tipe Kerja</label>
                    <Select value={selectedWorkType} onValueChange={setSelectedWorkType}>
                      <SelectTrigger className="w-full rounded-xl">
                        <SelectValue placeholder="Pilih tipe kerja" />
                      </SelectTrigger>
                      <SelectContent>
                        {WORK_TYPE_OPTIONS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {isWorkday && selectedWorkType === "WFO" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Lokasi Kerja</label>
                    <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                      <SelectTrigger className="w-full rounded-xl">
                        <SelectValue placeholder="Pilih lokasi" />
                      </SelectTrigger>
                      <SelectContent>
                        {workLocations?.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {isWorkday && (selectedWorkType === "WFH" || selectedWorkType === "WFA") && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Alasan WFH/WFA (opsional)</label>
                    <Textarea
                      value={workTypeReason}
                      onChange={(e) => setWorkTypeReason(e.target.value)}
                      placeholder="Tulis alasan kerja dari luar kantor..."
                      className="rounded-xl"
                      rows={2}
                    />
                    <p className="text-xs text-muted-foreground">
                      Tipe kerja ini butuh persetujuan HR sebelum tercatat final.
                    </p>
                  </div>
                )}

                {isWorkday && (
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <Checkbox
                      id="public-holiday-toggle"
                      checked={selectedIsPublicHoliday}
                      onCheckedChange={handlePublicHolidayToggle}
                    />
                    <Label htmlFor="public-holiday-toggle" className="text-xs font-medium text-muted-foreground cursor-pointer">
                      Tandai sebagai Public Holiday (kerja di tanggal merah)
                    </Label>
                  </div>
                )}

                {isWorkday && selectedIsPublicHoliday && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Public Holiday</label>
                    <Select value={selectedPublicHolidayId} onValueChange={setSelectedPublicHolidayId} disabled={!context?.publicHolidayOptions.length}>
                      <SelectTrigger className="w-full rounded-xl">
                        <SelectValue placeholder="Pilih public holiday" />
                      </SelectTrigger>
                      <SelectContent>
                        {context?.publicHolidayOptions.map((holiday) => (
                          <SelectItem key={holiday.id} value={holiday.id}>
                            {holiday.name} ({new Date(holiday.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!context?.publicHolidayOptions.length && (
                      <p className="text-xs text-destructive">Saldo public holiday belum tersedia.</p>
                    )}
                  </div>
                )}
              </div>

              {isWorkday && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs">
                  <MapPoint weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  {gpsLoading && <span className="text-muted-foreground">Mencari lokasi GPS...</span>}
                  {!gpsLoading && gpsCoords && <span className="text-muted-foreground">Lokasi GPS ditemukan.</span>}
                  {!gpsLoading && !gpsCoords && (
                    <>
                      <span className="text-destructive">Lokasi GPS belum tersedia.</span>
                      <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={requestGps}>
                        Coba lagi
                      </Button>
                    </>
                  )}
                </div>
              )}

              {isWorkday && context?.isPublicHoliday && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <span className="font-medium">Hari besar hari ini</span>
                  {context.publicHolidayName ? ` — ${context.publicHolidayName}` : ""}
                  <span className="block text-xs text-destructive/80 mt-0.5">
                    Ditandai HRD di kalender hari besar. Centang &quot;Tandai sebagai Public Holiday&quot; agar tercatat sebagai tanggal merah.
                  </span>
                </div>
              )}
            </div>
          )}

          {attendance?.clockInAt && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Login3 weight="BoldDuotone" className="h-4 w-4" />
                  Masuk: {formatTime(new Date(attendance.clockInAt))}
                </span>
                {attendance.clockOutAt && (
                  <span className="flex items-center gap-1">
                    <Logout3 weight="BoldDuotone" className="h-4 w-4" />
                    Keluar: {formatTime(new Date(attendance.clockOutAt))}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
                {attendance.workShift && (
                  <span>Shift: <span className="text-foreground font-medium">{attendance.workShift.name}</span></span>
                )}
                {attendance.workType && (
                  <Badge variant="outline">{WORK_TYPE_LABEL[attendance.workType] ?? attendance.workType}</Badge>
                )}
                {attendance.workType !== "WFO" &&
                  attendance.workTypeApprovalStatus &&
                  WORK_TYPE_APPROVAL_BADGE[attendance.workTypeApprovalStatus] && (
                    <Badge variant={WORK_TYPE_APPROVAL_BADGE[attendance.workTypeApprovalStatus]!.variant}>
                      {WORK_TYPE_APPROVAL_BADGE[attendance.workTypeApprovalStatus]!.label}
                    </Badge>
                  )}
                {attendance.workLocation && (
                  <span className="flex items-center gap-1">
                    <MapPoint weight="BoldDuotone" className="h-4 w-4 shrink-0" />
                    <span className="text-foreground font-medium">{attendance.workLocation.name}</span>
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3 justify-center">
            {canClockIn && pendingAction !== "in" && (
              <Button
                size="lg"
                className="rounded-full px-8"
                disabled={isMutating}
                onClick={handleClockInTap}
              >
                <Camera weight="BoldDuotone" className="h-5 w-5 mr-2" />
                Ambil Foto & Absen
              </Button>
            )}

            {showClockInDetails && (
              <>
                <Button
                  size="lg"
                  variant="ghost"
                  className="rounded-full px-6"
                  disabled={isMutating}
                  onClick={handleCancelClockIn}
                >
                  Batal
                </Button>
                <Button
                  size="lg"
                  className="rounded-full px-8"
                  disabled={submitClockInDisabled}
                  onClick={handleSubmitClockIn}
                >
                  <Login3 weight="BoldDuotone" className="h-5 w-5 mr-2" />
                  {isMutating ? "Menyimpan..." : "Simpan Absensi"}
                </Button>
              </>
            )}

            {canClockOut && (
              <Button
                size="lg"
                variant="secondary"
                className="rounded-full px-8"
                disabled={isMutating || gpsLoading}
                onClick={handleClockOutTap}
              >
                <Logout3 weight="BoldDuotone" className="h-5 w-5 mr-2" />
                {gpsLoading && pendingAction === "out" ? "Mencari lokasi..." : "Clock Out"}
              </Button>
            )}

            {isDone && (
              <p className="text-sm text-muted-foreground">
                Absensi hari ini sudah selesai. Sampai jumpa besok!
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <CameraModal
        open={cameraOpen}
        onClose={handleCameraClose}
        onCapture={handleCapture}
      />
    </>
  );
}
