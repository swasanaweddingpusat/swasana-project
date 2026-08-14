"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useAttendanceSettings, useUpdateAttendanceSettings } from "@/hooks/use-attendance";
import { Settings } from "@solar-icons/react";

function GlobalSettingsForm({ settings }: { settings: NonNullable<ReturnType<typeof useAttendanceSettings>["data"]> }) {
  const updateMutation = useUpdateAttendanceSettings();
  const [defaultLateTolerance, setDefaultLateTolerance] = useState(settings.defaultLateToleranceMinutes ?? 15);
  const [requireClockOutLocation, setRequireClockOutLocation] = useState(settings.requireClockOutLocation ?? false);

  function handleSave() {
    const payload = {
      ...settings,
      defaultLateToleranceMinutes: defaultLateTolerance,
      requireClockOutLocation,
    };

    updateMutation.mutate(payload, {
      onSuccess: () => toast.success("Pengaturan berhasil disimpan"),
      onError: (err) => toast.error(err.message),
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="global-tolerance">Default Toleransi Terlambat (menit)</Label>
        <Input
          id="global-tolerance"
          type="number"
          value={defaultLateTolerance}
          onChange={(e) => setDefaultLateTolerance(parseInt(e.target.value, 10) || 0)}
          className="rounded-xl w-32"
          min={0}
          max={120}
        />
        <p className="text-xs text-muted-foreground">
          Nilai default toleransi keterlambatan untuk shift baru.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-xl border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="require-clock-out-loc">Wajib Lokasi saat Clock Out</Label>
          <p className="text-xs text-muted-foreground">
            Karyawan harus berada dalam radius lokasi kerja saat clock out.
          </p>
        </div>
        <Switch
          id="require-clock-out-loc"
          checked={requireClockOutLocation}
          onCheckedChange={setRequireClockOutLocation}
        />
      </div>

      <Button
        className="rounded-full px-8"
        onClick={handleSave}
        disabled={updateMutation.isPending}
      >
        {updateMutation.isPending ? "Menyimpan..." : "Simpan Pengaturan"}
      </Button>
    </div>
  );
}

export function GlobalSettingsPanel() {
  const { data: settings, isLoading } = useAttendanceSettings();

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-heading text-lg">
          <Settings weight="BoldDuotone" className="h-5 w-5" />
          Pengaturan Umum
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-10 w-60 rounded-lg" />
            <Skeleton className="h-10 w-60 rounded-lg" />
          </div>
        )}

        {!isLoading && settings && (
          <GlobalSettingsForm key={settings.id} settings={settings} />
        )}
      </CardContent>
    </Card>
  );
}
