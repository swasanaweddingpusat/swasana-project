"use client";

import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLeaveTypes } from "@/hooks/use-leave-types";
import { useLeaveBalances } from "@/hooks/use-leave-balances";
import { useSubmitLeaveRequest } from "@/hooks/use-leave-requests";
import { countWeekdays, getAvailableBalance } from "@/lib/leave-helpers";
import { DocumentText } from "@solar-icons/react";

interface FormState {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason: string;
}

const EMPTY_FORM: FormState = {
  leaveTypeId: "",
  startDate: "",
  endDate: "",
  reason: "",
};

export function LeaveRequestForm() {
  const { data: session } = useSession();
  const { data: leaveTypes } = useLeaveTypes();
  const submitMutation = useSubmitLeaveRequest();

  const profileId = session?.user?.profileId;
  const currentYear = new Date().getFullYear();
  const { data: balances } = useLeaveBalances(
    profileId ? { profileId, year: currentYear } : undefined
  );

  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const selectedType = useMemo(
    () => leaveTypes?.find((t) => t.id === form.leaveTypeId),
    [leaveTypes, form.leaveTypeId]
  );

  const calculatedDays = useMemo(() => {
    if (!form.startDate || !form.endDate) return 0;
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    if (start > end) return 0;
    return countWeekdays(start, end);
  }, [form.startDate, form.endDate]);

  const balanceForType = useMemo(() => {
    if (!selectedType?.isDeductible || !balances) return null;
    return balances.find((b) => b.leaveTypeId === selectedType.id) ?? null;
  }, [selectedType, balances]);

  const availableDays = useMemo(() => {
    if (!balanceForType) return null;
    return getAvailableBalance(balanceForType);
  }, [balanceForType]);

  const isInsufficientBalance =
    availableDays !== null && calculatedDays > 0 && calculatedDays > availableDays;

  const handleSubmit = useCallback(() => {
    if (!form.leaveTypeId) {
      toast.error("Pilih jenis cuti terlebih dahulu");
      return;
    }
    if (!form.startDate || !form.endDate) {
      toast.error("Tanggal mulai dan selesai wajib diisi");
      return;
    }
    if (calculatedDays === 0) {
      toast.error("Periode cuti tidak mengandung hari kerja");
      return;
    }

    submitMutation.mutate(
      {
        leaveTypeId: form.leaveTypeId,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason || undefined,
      },
      {
        onSuccess: (result) => {
          if (result.success) {
            toast.success("Pengajuan cuti berhasil dikirim");
            setForm(EMPTY_FORM);
          } else {
            toast.error(result.error ?? "Gagal mengajukan cuti");
          }
        },
        onError: () => toast.error("Terjadi kesalahan"),
      }
    );
  }, [form, calculatedDays, submitMutation]);

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-lg flex items-center gap-2">
          <DocumentText weight="BoldDuotone" className="h-5 w-5" />
          Ajukan Cuti
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="leave-type">Jenis Cuti *</Label>
            <Select
              value={form.leaveTypeId}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, leaveTypeId: v }))
              }
            >
              <SelectTrigger id="leave-type" className="rounded-xl">
                <SelectValue placeholder="Pilih jenis cuti" />
              </SelectTrigger>
              <SelectContent>
                {leaveTypes?.map((lt) => (
                  <SelectItem key={lt.id} value={lt.id}>
                    {lt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="hidden sm:block" />

          <div className="grid gap-2">
            <Label htmlFor="start-date">Tanggal Mulai *</Label>
            <Input
              id="start-date"
              type="date"
              value={form.startDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, startDate: e.target.value }))
              }
              className="rounded-xl"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="end-date">Tanggal Selesai *</Label>
            <Input
              id="end-date"
              type="date"
              value={form.endDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, endDate: e.target.value }))
              }
              className="rounded-xl"
            />
          </div>

          {calculatedDays > 0 && (
            <div className="sm:col-span-2 flex flex-wrap items-center gap-4 rounded-xl bg-muted/50 px-4 py-3">
              <p className="text-sm font-medium">
                Total hari kerja:{" "}
                <span className="font-bold">{calculatedDays} hari</span>
              </p>
              {availableDays !== null && (
                <p
                  className={`text-sm ${isInsufficientBalance ? "text-destructive font-medium" : "text-muted-foreground"}`}
                >
                  Saldo tersedia: {availableDays} hari
                  {isInsufficientBalance && " (tidak cukup)"}
                </p>
              )}
            </div>
          )}

          <div className="sm:col-span-2 grid gap-2">
            <Label htmlFor="reason">Alasan (opsional)</Label>
            <Textarea
              id="reason"
              value={form.reason}
              onChange={(e) =>
                setForm((f) => ({ ...f, reason: e.target.value }))
              }
              placeholder="Tulis alasan cuti..."
              className="rounded-xl"
              rows={3}
            />
          </div>

          <div className="sm:col-span-2 flex justify-end">
            <Button
              className="rounded-full"
              onClick={handleSubmit}
              disabled={
                submitMutation.isPending ||
                !form.leaveTypeId ||
                !form.startDate ||
                !form.endDate ||
                isInsufficientBalance
              }
            >
              {submitMutation.isPending ? "Mengirim..." : "Ajukan Cuti"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
