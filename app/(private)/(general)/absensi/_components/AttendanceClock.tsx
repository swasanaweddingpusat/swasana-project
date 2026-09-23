"use client";

import { useState, useEffect, useCallback } from "react";
import { useAttendanceToday, useAttendanceSettings, useClockIn, useClockOut } from "@/hooks/use-attendance";
import { useWorkShifts } from "@/hooks/use-work-shifts";
import { useWorkLocations } from "@/hooks/use-work-locations";
import type { AttendanceStatusValue } from "@/lib/validations/attendance";
import { CameraModal } from "./CameraModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ClockCircle, Login3, Logout3, MapPoint } from "@solar-icons/react";

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
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatusValue | "">("");
  const [selectedIsPublicHoliday, setSelectedIsPublicHoliday] = useState(false);
  const [selectedPublicHolidayId, setSelectedPublicHolidayId] = useState<string>("");
  const [selectedShiftId, setSelectedShiftId] = useState<string>("");
  const [selectedWorkType, setSelectedWorkType] = useState<string>("");
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");

  const { data: todayData, isLoading: todayLoading } = useAttendanceToday();
  const { data: settings } = useAttendanceSettings();
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

  const handleAction = useCallback((action: ClockAction) => {
    if (!settings) {
      toast.error("Settings absensi belum dikonfigurasi. Hubungi admin.");
      return;
    }

    setGpsLoading(true);
    setPendingAction(action);

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
  }, [settings]);

  const handleClockIn = useCallback(() => {
    if (!selectedStatus) {
      toast.error("Pilih status kehadiran terlebih dahulu");
      return;
    }

    if (!isWorkday) {
      // Off flow: plain day off. Selfie required, but no GPS/location.
      setPendingAction("in");
      setCameraOpen(true);
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

    handleAction("in");
  }, [selectedStatus, isWorkday, selectedIsPublicHoliday, selectedPublicHolidayId, selectedShiftId, selectedWorkType, selectedLocationId, handleAction]);

  const handleCapture = useCallback((photoBase64: string) => {
    setCameraOpen(false);
    if (!pendingAction) return;

    if (pendingAction === "in") {
      // Off flow: selfie only, no GPS. Always a plain day off.
      if (!isWorkday) {
        clockInMutation.mutate(
          {
            attendanceStatus: "DAY_OFF",
            photoBase64,
          },
          {
            onSuccess: () => {
              toast.success("Absensi berhasil disimpan!");
              setPendingAction(null);
            },
            onError: (err) => {
              toast.error(err.message);
              setPendingAction(null);
            },
          },
        );
        return;
      }

      if (!gpsCoords) return;
      clockInMutation.mutate(
        {
          attendanceStatus: "WORKDAY",
          photoBase64,
          lat: gpsCoords.lat,
          lng: gpsCoords.lng,
          workShiftId: selectedShiftId,
          workType: selectedWorkType as "WFO" | "WFH" | "WFA",
          workLocationId: selectedWorkType === "WFO" ? selectedLocationId : undefined,
          // Nama hari besar tetap ditentukan HRD (master by-date); karyawan cuma menandai.
          isPublicHoliday: selectedIsPublicHoliday,
          publicHolidayId: selectedIsPublicHoliday ? (selectedPublicHolidayId || undefined) : undefined,
        },
        {
          onSuccess: () => {
            toast.success("Clock in berhasil!");
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
  }, [gpsCoords, pendingAction, isWorkday, selectedIsPublicHoliday, selectedPublicHolidayId, clockInMutation, clockOutMutation, selectedShiftId, selectedWorkType, selectedLocationId]);

  const handleCameraClose = useCallback(() => {
    setCameraOpen(false);
    setPendingAction(null);
    setGpsCoords(null);
  }, []);

  const canClockIn = !attendance?.clockInAt;
  const canClockOut = !!attendance?.clockInAt && !attendance?.clockOutAt;
  const isDone = !!attendance?.clockOutAt;
  const clockInDisabled =
    !settings ||
    isMutating ||
    gpsLoading ||
    !selectedStatus ||
    (isWorkday && !selectedShiftId) ||
    (isWorkday && !selectedWorkType) ||
    (isWorkday && selectedWorkType === "WFO" && !selectedLocationId) ||
    (isWorkday && selectedIsPublicHoliday && !selectedPublicHolidayId);

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
            <p className="text-sm text-muted-foreground">{currentTime ? formatDate(currentTime) : " "}</p>
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

          {canClockIn && (
            <div className="space-y-3">
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
                {attendance.workLocation && (
                  <span className="flex items-center gap-1">
                    <MapPoint weight="BoldDuotone" className="h-4 w-4 shrink-0" />
                    <span className="text-foreground font-medium">{attendance.workLocation.name}</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {!settings && !todayLoading && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive text-center">
              <MapPoint weight="BoldDuotone" className="inline h-4 w-4 mr-1" />
              Settings absensi belum dikonfigurasi. Hubungi admin.
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3 justify-center">
            {canClockIn && (
              <Button
                size="lg"
                className="rounded-full px-8"
                disabled={clockInDisabled}
                onClick={handleClockIn}
              >
                <Login3 weight="BoldDuotone" className="h-5 w-5 mr-2" />
                {gpsLoading && pendingAction === "in" ? "Mencari lokasi..." : isWorkday ? "Clock In" : "Catat Kehadiran"}
              </Button>
            )}

            {canClockOut && (
              <Button
                size="lg"
                variant="secondary"
                className="rounded-full px-8"
                disabled={isMutating || gpsLoading}
                onClick={() => handleAction("out")}
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
