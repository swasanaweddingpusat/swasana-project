"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionGate } from "@/components/shared/permission-gate";
import { useUpdateEmployee } from "@/hooks/use-employees";
import { Pen, CheckCircle, CloseCircle } from "@solar-icons/react";
import type { EmployeeDetail } from "@/lib/queries/employees";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PayrollSectionProps {
  employee: EmployeeDetail;
}

interface EditState {
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  npwp: string;
  bpjsKesehatan: string;
  bpjsKetenagakerjaan: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PayrollSection({ employee }: PayrollSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const updateMutation = useUpdateEmployee();

  const buildEditState = useCallback(
    (): EditState => ({
      bankName: employee.bankName ?? "",
      bankAccountNumber: employee.bankAccountNumber ?? "",
      bankAccountHolder: employee.bankAccountHolder ?? "",
      npwp: employee.npwp ?? "",
      bpjsKesehatan: employee.bpjsKesehatan ?? "",
      bpjsKetenagakerjaan: employee.bpjsKetenagakerjaan ?? "",
    }),
    [employee]
  );

  const [form, setForm] = useState<EditState>(buildEditState);

  const handleEdit = useCallback(() => {
    setForm(buildEditState());
    setIsEditing(true);
  }, [buildEditState]);

  const handleCancel = useCallback(() => {
    setForm(buildEditState());
    setIsEditing(false);
  }, [buildEditState]);

  const handleChange = useCallback(
    (field: keyof EditState, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleSave = useCallback(() => {
    const payload: Record<string, unknown> = {};

    if (form.bankName !== (employee.bankName ?? "")) {
      payload.bankName = form.bankName || undefined;
    }
    if (form.bankAccountNumber !== (employee.bankAccountNumber ?? "")) {
      payload.bankAccountNumber = form.bankAccountNumber || undefined;
    }
    if (form.bankAccountHolder !== (employee.bankAccountHolder ?? "")) {
      payload.bankAccountHolder = form.bankAccountHolder || undefined;
    }
    if (form.npwp !== (employee.npwp ?? "")) {
      payload.npwp = form.npwp || undefined;
    }
    if (form.bpjsKesehatan !== (employee.bpjsKesehatan ?? "")) {
      payload.bpjsKesehatan = form.bpjsKesehatan || undefined;
    }
    if (form.bpjsKetenagakerjaan !== (employee.bpjsKetenagakerjaan ?? "")) {
      payload.bpjsKetenagakerjaan = form.bpjsKetenagakerjaan || undefined;
    }

    if (Object.keys(payload).length === 0) {
      toast.info("Tidak ada perubahan.");
      setIsEditing(false);
      return;
    }

    updateMutation.mutate(
      { id: employee.id, data: payload },
      {
        onSuccess: (result) => {
          if (result.success) {
            toast.success("Data payroll berhasil diperbarui");
            setIsEditing(false);
          } else {
            toast.error(result.error ?? "Gagal memperbarui data");
          }
        },
        onError: () => {
          toast.error("Terjadi kesalahan");
        },
      }
    );
  }, [form, employee, updateMutation]);

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading text-lg">
            Informasi Payroll
          </CardTitle>
          {!isEditing && (
            <PermissionGate module="hr" action="edit">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full gap-1.5"
                onClick={handleEdit}
              >
                <Pen weight="BoldDuotone" className="h-4 w-4" />
                Edit
              </Button>
            </PermissionGate>
          )}
          {isEditing && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full gap-1.5"
                onClick={handleCancel}
                disabled={updateMutation.isPending}
              >
                <CloseCircle weight="BoldDuotone" className="h-4 w-4" />
                Batal
              </Button>
              <Button
                size="sm"
                className="rounded-full gap-1.5"
                onClick={handleSave}
                disabled={updateMutation.isPending}
              >
                <CheckCircle weight="BoldDuotone" className="h-4 w-4" />
                {updateMutation.isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldRow
            label="Bank"
            value={employee.bankName}
            isEditing={isEditing}
            editNode={
              <Input
                className="rounded-xl"
                value={form.bankName}
                onChange={(e) => handleChange("bankName", e.target.value)}
              />
            }
          />
          <FieldRow
            label="No. Rekening"
            value={employee.bankAccountNumber}
            isEditing={isEditing}
            editNode={
              <Input
                className="rounded-xl"
                value={form.bankAccountNumber}
                onChange={(e) =>
                  handleChange("bankAccountNumber", e.target.value)
                }
              />
            }
          />
          <FieldRow
            label="Pemegang Rekening"
            value={employee.bankAccountHolder}
            isEditing={isEditing}
            editNode={
              <Input
                className="rounded-xl"
                value={form.bankAccountHolder}
                onChange={(e) =>
                  handleChange("bankAccountHolder", e.target.value)
                }
              />
            }
          />
          <FieldRow
            label="NPWP"
            value={employee.npwp}
            isEditing={isEditing}
            editNode={
              <Input
                className="rounded-xl"
                value={form.npwp}
                onChange={(e) => handleChange("npwp", e.target.value)}
              />
            }
          />
          <FieldRow
            label="BPJS Kesehatan"
            value={employee.bpjsKesehatan}
            isEditing={isEditing}
            editNode={
              <Input
                className="rounded-xl"
                value={form.bpjsKesehatan}
                onChange={(e) =>
                  handleChange("bpjsKesehatan", e.target.value)
                }
              />
            }
          />
          <FieldRow
            label="BPJS Ketenagakerjaan"
            value={employee.bpjsKetenagakerjaan}
            isEditing={isEditing}
            editNode={
              <Input
                className="rounded-xl"
                value={form.bpjsKetenagakerjaan}
                onChange={(e) =>
                  handleChange("bpjsKetenagakerjaan", e.target.value)
                }
              />
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Field Row ───────────────────────────────────────────────────────────────

interface FieldRowProps {
  label: string;
  value: string | number | null | undefined;
  isEditing: boolean;
  editNode?: React.ReactNode;
}

function FieldRow({ label, value, isEditing, editNode }: FieldRowProps) {
  if (isEditing && editNode) {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm text-muted-foreground">{label}</Label>
        {editNode}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value ?? "-"}</p>
    </div>
  );
}
