"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PermissionGate } from "@/components/shared/permission-gate";
import { useUpdateEmployee } from "@/hooks/use-employees";
import { useDepartments } from "@/hooks/use-departments";
import { usePositions } from "@/hooks/use-positions";
import { Pen, CheckCircle, CloseCircle } from "@solar-icons/react";
import type { EmployeeDetail } from "@/lib/queries/employees";

// ─── Constants ───────────────────────────────────────────────────────────────

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "permanent", label: "Permanent" },
  { value: "contract", label: "Kontrak" },
  { value: "probation", label: "Probation" },
  { value: "intern", label: "Magang" },
];

const DATA_SCOPE_LABELS: Record<string, string> = {
  own: "Own",
  group: "Group",
  all: "All",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Aktif",
  inactive: "Tidak Aktif",
  suspended: "Suspended",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(date: string | Date | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function toDateInputValue(date: string | Date | null): string {
  if (!date) return "";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface EmploymentSectionProps {
  employee: EmployeeDetail;
}

interface EditState {
  departmentId: string;
  positionId: string;
  employmentType: string;
  joinDate: string;
  contractStartDate: string;
  contractEndDate: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function EmploymentSection({ employee }: EmploymentSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const updateMutation = useUpdateEmployee();
  const { data: departments } = useDepartments();
  const { data: positions } = usePositions();

  const buildEditState = useCallback(
    (): EditState => ({
      departmentId: employee.departmentId ?? "",
      positionId: employee.positionId ?? "",
      employmentType: employee.employmentType ?? "",
      joinDate: toDateInputValue(employee.joinDate),
      contractStartDate: toDateInputValue(employee.contractStartDate),
      contractEndDate: toDateInputValue(employee.contractEndDate),
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

    if (form.departmentId !== (employee.departmentId ?? "")) {
      payload.departmentId = form.departmentId || undefined;
    }
    if (form.positionId !== (employee.positionId ?? "")) {
      payload.positionId = form.positionId || undefined;
    }
    if (form.employmentType !== (employee.employmentType ?? "")) {
      payload.employmentType = form.employmentType || undefined;
    }
    if (form.joinDate !== toDateInputValue(employee.joinDate)) {
      payload.joinDate = form.joinDate || undefined;
    }
    if (form.contractStartDate !== toDateInputValue(employee.contractStartDate)) {
      payload.contractStartDate = form.contractStartDate || undefined;
    }
    if (form.contractEndDate !== toDateInputValue(employee.contractEndDate)) {
      payload.contractEndDate = form.contractEndDate || undefined;
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
            toast.success("Data kepegawaian berhasil diperbarui");
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

  const showContractDates =
    isEditing
      ? form.employmentType === "contract"
      : employee.employmentType === "contract";

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading text-lg">
            Informasi Kepegawaian
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
          {/* Employee Number — always read-only */}
          <FieldRow
            label="No. Karyawan"
            value={`#${employee.employeeNumber}`}
            isEditing={false}
          />

          {/* Department */}
          <FieldRow
            label="Departemen"
            value={employee.department?.name}
            isEditing={isEditing}
            editNode={
              <Select
                value={form.departmentId}
                onValueChange={(v) => handleChange("departmentId", v)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Pilih departemen" />
                </SelectTrigger>
                <SelectContent>
                  {departments?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />

          {/* Position */}
          <FieldRow
            label="Posisi"
            value={employee.position?.name}
            isEditing={isEditing}
            editNode={
              <Select
                value={form.positionId}
                onValueChange={(v) => handleChange("positionId", v)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Pilih posisi" />
                </SelectTrigger>
                <SelectContent>
                  {positions?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />

          {/* Manager — read-only */}
          <FieldRow
            label="Manager"
            value={employee.manager?.fullName}
            isEditing={false}
          />

          {/* Role — read-only */}
          <FieldRow
            label="Role"
            value={employee.role?.name}
            isEditing={false}
          />

          {/* Data Scope — read-only */}
          <FieldRow
            label="Data Scope"
            value={DATA_SCOPE_LABELS[employee.dataScope] ?? employee.dataScope}
            isEditing={false}
          />

          {/* Employment Type */}
          <FieldRow
            label="Tipe Karyawan"
            value={
              employee.employmentType
                ? EMPLOYMENT_TYPE_OPTIONS.find(
                    (o) => o.value === employee.employmentType
                  )?.label ?? employee.employmentType
                : null
            }
            isEditing={isEditing}
            editNode={
              <Select
                value={form.employmentType}
                onValueChange={(v) => handleChange("employmentType", v)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Pilih tipe" />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />

          {/* Status — read-only */}
          <FieldRow
            label="Status"
            value={STATUS_LABELS[employee.status] ?? employee.status}
            isEditing={false}
          />

          {/* Join Date */}
          <FieldRow
            label="Tanggal Masuk"
            value={formatDate(employee.joinDate)}
            isEditing={isEditing}
            editNode={
              <Input
                type="date"
                className="rounded-xl"
                value={form.joinDate}
                onChange={(e) => handleChange("joinDate", e.target.value)}
              />
            }
          />

          {/* Resign Date — read-only */}
          <FieldRow
            label="Tanggal Resign"
            value={formatDate(employee.resignDate)}
            isEditing={false}
          />

          {/* Contract dates — visible when type is contract */}
          {showContractDates && (
            <>
              <FieldRow
                label="Kontrak Mulai"
                value={formatDate(employee.contractStartDate)}
                isEditing={isEditing}
                editNode={
                  <Input
                    type="date"
                    className="rounded-xl"
                    value={form.contractStartDate}
                    onChange={(e) =>
                      handleChange("contractStartDate", e.target.value)
                    }
                  />
                }
              />
              <FieldRow
                label="Kontrak Selesai"
                value={formatDate(employee.contractEndDate)}
                isEditing={isEditing}
                editNode={
                  <Input
                    type="date"
                    className="rounded-xl"
                    value={form.contractEndDate}
                    onChange={(e) =>
                      handleChange("contractEndDate", e.target.value)
                    }
                  />
                }
              />
            </>
          )}
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
