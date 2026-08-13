"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAttendanceSettings, useUpdateAttendanceSettings } from "@/hooks/use-attendance";
import { attendanceSettingsSchema, type AttendanceSettingsInput } from "@/lib/validations/attendance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Settings, AltArrowDown } from "@solar-icons/react";

export function AttendanceSettingsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: settings, isLoading } = useAttendanceSettings();
  const updateMutation = useUpdateAttendanceSettings();

  const form = useForm<AttendanceSettingsInput>({
    resolver: zodResolver(attendanceSettingsSchema),
    defaultValues: {
      workStartTime: "08:00",
      workEndTime: "17:00",
      lateToleranceMinutes: 15,
      officeLatitude: 0,
      officeLongitude: 0,
      officeRadiusMeters: 100,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        workStartTime: settings.workStartTime,
        workEndTime: settings.workEndTime,
        lateToleranceMinutes: settings.lateToleranceMinutes,
        officeLatitude: settings.officeLatitude,
        officeLongitude: settings.officeLongitude,
        officeRadiusMeters: settings.officeRadiusMeters,
      });
    }
  }, [settings, form]);

  function onSubmit(data: AttendanceSettingsInput) {
    updateMutation.mutate(data, {
      onSuccess: () => toast.success("Settings berhasil disimpan"),
      onError: (err) => toast.error(err.message),
    });
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full text-left cursor-pointer">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between font-heading text-lg">
              <span className="flex items-center gap-2">
                <Settings weight="BoldDuotone" className="h-5 w-5" />
                Pengaturan Absensi
              </span>
              <AltArrowDown
                weight="BoldDuotone"
                className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Memuat settings...</p>
            ) : (
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="workStartTime">Jam Mulai Kerja</Label>
                    <Input id="workStartTime" type="time" className="rounded-xl" {...form.register("workStartTime")} />
                    {form.formState.errors.workStartTime && (
                      <p className="text-xs text-destructive">{form.formState.errors.workStartTime.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="workEndTime">Jam Selesai Kerja</Label>
                    <Input id="workEndTime" type="time" className="rounded-xl" {...form.register("workEndTime")} />
                    {form.formState.errors.workEndTime && (
                      <p className="text-xs text-destructive">{form.formState.errors.workEndTime.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lateToleranceMinutes">Toleransi Terlambat (menit)</Label>
                  <Input
                    id="lateToleranceMinutes"
                    type="number"
                    className="rounded-xl w-32"
                    {...form.register("lateToleranceMinutes", { valueAsNumber: true })}
                  />
                  {form.formState.errors.lateToleranceMinutes && (
                    <p className="text-xs text-destructive">{form.formState.errors.lateToleranceMinutes.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="officeLatitude">Latitude Kantor</Label>
                    <Input
                      id="officeLatitude"
                      type="number"
                      step="any"
                      className="rounded-xl"
                      {...form.register("officeLatitude", { valueAsNumber: true })}
                    />
                    {form.formState.errors.officeLatitude && (
                      <p className="text-xs text-destructive">{form.formState.errors.officeLatitude.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="officeLongitude">Longitude Kantor</Label>
                    <Input
                      id="officeLongitude"
                      type="number"
                      step="any"
                      className="rounded-xl"
                      {...form.register("officeLongitude", { valueAsNumber: true })}
                    />
                    {form.formState.errors.officeLongitude && (
                      <p className="text-xs text-destructive">{form.formState.errors.officeLongitude.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="officeRadiusMeters">Radius (meter)</Label>
                    <Input
                      id="officeRadiusMeters"
                      type="number"
                      className="rounded-xl"
                      {...form.register("officeRadiusMeters", { valueAsNumber: true })}
                    />
                    {form.formState.errors.officeRadiusMeters && (
                      <p className="text-xs text-destructive">{form.formState.errors.officeRadiusMeters.message}</p>
                    )}
                  </div>
                </div>

                <Button
                  type="submit"
                  className="rounded-full px-8"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? "Menyimpan..." : "Simpan Settings"}
                </Button>
              </form>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
