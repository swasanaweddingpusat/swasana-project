"use client";

import { useState, useEffect, useCallback } from "react";
import { useAttendanceToday, useAttendanceSettings, useClockIn, useClockOut } from "@/hooks/use-attendance";
import { CameraModal } from "./CameraModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ClockCircle, Login3, Logout3, MapPoint } from "@solar-icons/react";

type ClockAction = "in" | "out";

function formatTime(date: Date): string {
  return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

export function AttendanceClock() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<ClockAction | null>(null);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  const { data: todayData, isLoading: todayLoading } = useAttendanceToday();
  const { data: settings } = useAttendanceSettings();
  const clockInMutation = useClockIn();
  const clockOutMutation = useClockOut();

  const attendance = todayData?.attendance ?? null;
  const shift = todayData?.shift ?? null;
  const shiftSource = todayData?.shiftSource ?? null;

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const isMutating = clockInMutation.isPending || clockOutMutation.isPending;

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

  const handleCapture = useCallback((photoBase64: string) => {
    setCameraOpen(false);
    if (!gpsCoords || !pendingAction) return;

    const payload = { photoBase64, lat: gpsCoords.lat, lng: gpsCoords.lng };
    const mutation = pendingAction === "in" ? clockInMutation : clockOutMutation;
    const label = pendingAction === "in" ? "Clock in" : "Clock out";

    mutation.mutate(payload, {
      onSuccess: () => {
        toast.success(`${label} berhasil!`);
        setPendingAction(null);
        setGpsCoords(null);
      },
      onError: (err) => {
        toast.error(err.message);
        setPendingAction(null);
        setGpsCoords(null);
      },
    });
  }, [gpsCoords, pendingAction, clockInMutation, clockOutMutation]);

  const handleCameraClose = useCallback(() => {
    setCameraOpen(false);
    setPendingAction(null);
    setGpsCoords(null);
  }, []);

  const canClockIn = !attendance?.clockInAt;
  const canClockOut = !!attendance?.clockInAt && !attendance?.clockOutAt;
  const isDone = !!attendance?.clockOutAt;

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
              {formatTime(currentTime)}
            </p>
            <p className="text-sm text-muted-foreground">{formatDate(currentTime)}</p>
          </div>

          <div className="flex items-center justify-center gap-3">
            {getStatusBadge()}
          </div>

          {shift ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <ClockCircle weight="BoldDuotone" className="h-4 w-4 shrink-0" />
              <span>
                Shift: <span className="text-foreground font-medium">{shift.name}</span>{" "}
                ({shift.startTime} - {shift.endTime})
              </span>
              {shiftSource === "override" && (
                <Badge variant="secondary" className="text-xs">Override</Badge>
              )}
            </div>
          ) : (
            !todayLoading && (
              <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground text-center">
                <ClockCircle weight="BoldDuotone" className="inline h-4 w-4 mr-1" />
                Anda belum di-assign ke shift/lokasi kerja
              </div>
            )
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
              {attendance.workLocation && (
                <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                  <MapPoint weight="BoldDuotone" className="h-4 w-4 shrink-0" />
                  <span>Lokasi: <span className="text-foreground font-medium">{attendance.workLocation.name}</span></span>
                </div>
              )}
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
                disabled={!settings || isMutating || gpsLoading}
                onClick={() => handleAction("in")}
              >
                <Login3 weight="BoldDuotone" className="h-5 w-5 mr-2" />
                {gpsLoading && pendingAction === "in" ? "Mencari lokasi..." : "Clock In"}
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
