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
import { Pen, CheckCircle, CloseCircle } from "@solar-icons/react";
import type { EmployeeDetail } from "@/lib/queries/employees";

// ─── Constants ───────────────────────────────────────────────────────────────

const GENDER_OPTIONS = [
  { value: "MALE", label: "Laki-laki" },
  { value: "FEMALE", label: "Perempuan" },
];

const RELIGION_OPTIONS = [
  { value: "islam", label: "Islam" },
  { value: "kristen", label: "Kristen" },
  { value: "katolik", label: "Katolik" },
  { value: "hindu", label: "Hindu" },
  { value: "buddha", label: "Buddha" },
  { value: "konghucu", label: "Konghucu" },
];

const BLOOD_TYPE_OPTIONS = ["A", "B", "AB", "O"];

const MARITAL_OPTIONS = [
  { value: "single", label: "Belum Menikah" },
  { value: "married", label: "Menikah" },
  { value: "divorced", label: "Cerai Hidup" },
  { value: "widowed", label: "Cerai Mati" },
];

const EDUCATION_OPTIONS = [
  "SD",
  "SMP",
  "SMA/SMK",
  "D1",
  "D2",
  "D3",
  "S1",
  "S2",
  "S3",
];

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

function genderLabel(val: string | null): string {
  if (!val) return "-";
  const match = GENDER_OPTIONS.find((g) => g.value === val);
  return match ? match.label : val;
}

function religionLabel(val: string | null): string {
  if (!val) return "-";
  const match = RELIGION_OPTIONS.find((r) => r.value === val);
  return match ? match.label : val;
}

function maritalLabel(val: string | null): string {
  if (!val) return "-";
  const match = MARITAL_OPTIONS.find((m) => m.value === val);
  return match ? match.label : val;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface PersonalInfoSectionProps {
  employee: EmployeeDetail;
}

interface EditState {
  fullName: string;
  nickName: string;
  gender: string;
  nik: string;
  kkNumber: string;
  placeOfBirth: string;
  dateOfBirth: string;
  religion: string;
  bloodType: string;
  maritalStatus: string;
  numberOfChildren: string;
  lastEducation: string;
  motherName: string;
  phoneNumber: string;
  ktpAddress: string;
  currentAddress: string;
  city: string;
  emergencyContactName: string;
  emergencyContactRel: string;
  emergencyContactPhone: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PersonalInfoSection({ employee }: PersonalInfoSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const updateMutation = useUpdateEmployee();

  const buildEditState = useCallback(
    (): EditState => ({
      fullName: employee.fullName ?? "",
      nickName: employee.nickName ?? "",
      gender: employee.gender ?? "",
      nik: employee.nik ?? "",
      kkNumber: employee.kkNumber ?? "",
      placeOfBirth: employee.placeOfBirth ?? "",
      dateOfBirth: toDateInputValue(employee.dateOfBirth),
      religion: employee.religion ?? "",
      bloodType: employee.bloodType ?? "",
      maritalStatus: employee.maritalStatus ?? "",
      numberOfChildren: employee.numberOfChildren?.toString() ?? "",
      lastEducation: employee.lastEducation ?? "",
      motherName: employee.motherName ?? "",
      phoneNumber: employee.phoneNumber ?? "",
      ktpAddress: employee.ktpAddress ?? "",
      currentAddress: employee.currentAddress ?? "",
      city: employee.city ?? "",
      emergencyContactName: employee.emergencyContactName ?? "",
      emergencyContactRel: employee.emergencyContactRel ?? "",
      emergencyContactPhone: employee.emergencyContactPhone ?? "",
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

    if (form.fullName && form.fullName !== (employee.fullName ?? "")) {
      payload.fullName = form.fullName;
    }
    if (form.nickName !== (employee.nickName ?? "")) {
      payload.nickName = form.nickName || undefined;
    }
    if (form.gender !== (employee.gender ?? "")) {
      payload.gender = form.gender || undefined;
    }
    if (form.nik !== (employee.nik ?? "")) {
      payload.nik = form.nik || undefined;
    }
    if (form.kkNumber !== (employee.kkNumber ?? "")) {
      payload.kkNumber = form.kkNumber || undefined;
    }
    if (form.placeOfBirth !== (employee.placeOfBirth ?? "")) {
      payload.placeOfBirth = form.placeOfBirth || undefined;
    }
    if (form.dateOfBirth !== toDateInputValue(employee.dateOfBirth)) {
      payload.dateOfBirth = form.dateOfBirth || undefined;
    }
    if (form.religion !== (employee.religion ?? "")) {
      payload.religion = form.religion || undefined;
    }
    if (form.bloodType !== (employee.bloodType ?? "")) {
      payload.bloodType = form.bloodType || undefined;
    }
    if (form.maritalStatus !== (employee.maritalStatus ?? "")) {
      payload.maritalStatus = form.maritalStatus || undefined;
    }
    const childrenNum = form.numberOfChildren ? parseInt(form.numberOfChildren, 10) : undefined;
    if (childrenNum !== (employee.numberOfChildren ?? undefined)) {
      payload.numberOfChildren = childrenNum;
    }
    if (form.lastEducation !== (employee.lastEducation ?? "")) {
      payload.lastEducation = form.lastEducation || undefined;
    }
    if (form.motherName !== (employee.motherName ?? "")) {
      payload.motherName = form.motherName || undefined;
    }
    if (form.phoneNumber !== (employee.phoneNumber ?? "")) {
      payload.phoneNumber = form.phoneNumber || undefined;
    }
    if (form.ktpAddress !== (employee.ktpAddress ?? "")) {
      payload.ktpAddress = form.ktpAddress || undefined;
    }
    if (form.currentAddress !== (employee.currentAddress ?? "")) {
      payload.currentAddress = form.currentAddress || undefined;
    }
    if (form.city !== (employee.city ?? "")) {
      payload.city = form.city || undefined;
    }
    if (form.emergencyContactName !== (employee.emergencyContactName ?? "")) {
      payload.emergencyContactName = form.emergencyContactName || undefined;
    }
    if (form.emergencyContactRel !== (employee.emergencyContactRel ?? "")) {
      payload.emergencyContactRel = form.emergencyContactRel || undefined;
    }
    if (form.emergencyContactPhone !== (employee.emergencyContactPhone ?? "")) {
      payload.emergencyContactPhone = form.emergencyContactPhone || undefined;
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
            toast.success("Data personal berhasil diperbarui");
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
    <div className="space-y-4">
      {/* ─── Identitas ──────────────────────────────────────────────── */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-lg">Identitas</CardTitle>
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
              label="Nama Lengkap"
              value={employee.fullName}
              isEditing={isEditing}
              editNode={
                <Input
                  className="rounded-xl"
                  value={form.fullName}
                  onChange={(e) => handleChange("fullName", e.target.value)}
                />
              }
            />
            <FieldRow
              label="Nama Panggilan"
              value={employee.nickName}
              isEditing={isEditing}
              editNode={
                <Input
                  className="rounded-xl"
                  value={form.nickName}
                  onChange={(e) => handleChange("nickName", e.target.value)}
                />
              }
            />
            <FieldRow
              label="Gender"
              value={genderLabel(employee.gender)}
              isEditing={isEditing}
              editNode={
                <Select
                  value={form.gender}
                  onValueChange={(v) => handleChange("gender", v)}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Pilih gender" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
            <FieldRow
              label="NIK"
              value={employee.nik}
              isEditing={isEditing}
              editNode={
                <Input
                  className="rounded-xl"
                  value={form.nik}
                  onChange={(e) => handleChange("nik", e.target.value)}
                />
              }
            />
            <FieldRow
              label="No. KK"
              value={employee.kkNumber}
              isEditing={isEditing}
              editNode={
                <Input
                  className="rounded-xl"
                  value={form.kkNumber}
                  onChange={(e) => handleChange("kkNumber", e.target.value)}
                />
              }
            />
            <FieldRow
              label="Tempat Lahir"
              value={employee.placeOfBirth}
              isEditing={isEditing}
              editNode={
                <Input
                  className="rounded-xl"
                  value={form.placeOfBirth}
                  onChange={(e) => handleChange("placeOfBirth", e.target.value)}
                />
              }
            />
            <FieldRow
              label="Tanggal Lahir"
              value={formatDate(employee.dateOfBirth)}
              isEditing={isEditing}
              editNode={
                <Input
                  type="date"
                  className="rounded-xl"
                  value={form.dateOfBirth}
                  onChange={(e) => handleChange("dateOfBirth", e.target.value)}
                />
              }
            />
            <FieldRow
              label="Agama"
              value={religionLabel(employee.religion)}
              isEditing={isEditing}
              editNode={
                <Select
                  value={form.religion}
                  onValueChange={(v) => handleChange("religion", v)}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Pilih agama" />
                  </SelectTrigger>
                  <SelectContent>
                    {RELIGION_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
            <FieldRow
              label="Golongan Darah"
              value={employee.bloodType}
              isEditing={isEditing}
              editNode={
                <Select
                  value={form.bloodType}
                  onValueChange={(v) => handleChange("bloodType", v)}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Pilih golongan darah" />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOOD_TYPE_OPTIONS.map((bt) => (
                      <SelectItem key={bt} value={bt}>
                        {bt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
            <FieldRow
              label="Status Perkawinan"
              value={maritalLabel(employee.maritalStatus)}
              isEditing={isEditing}
              editNode={
                <Select
                  value={form.maritalStatus}
                  onValueChange={(v) => handleChange("maritalStatus", v)}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Pilih status" />
                  </SelectTrigger>
                  <SelectContent>
                    {MARITAL_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
            <FieldRow
              label="Jumlah Anak"
              value={employee.numberOfChildren?.toString()}
              isEditing={isEditing}
              editNode={
                <Input
                  type="number"
                  min={0}
                  className="rounded-xl"
                  value={form.numberOfChildren}
                  onChange={(e) =>
                    handleChange("numberOfChildren", e.target.value)
                  }
                />
              }
            />
            <FieldRow
              label="Pendidikan Terakhir"
              value={employee.lastEducation}
              isEditing={isEditing}
              editNode={
                <Select
                  value={form.lastEducation}
                  onValueChange={(v) => handleChange("lastEducation", v)}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Pilih pendidikan" />
                  </SelectTrigger>
                  <SelectContent>
                    {EDUCATION_OPTIONS.map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
            <FieldRow
              label="Nama Ibu"
              value={employee.motherName}
              isEditing={isEditing}
              editNode={
                <Input
                  className="rounded-xl"
                  value={form.motherName}
                  onChange={(e) => handleChange("motherName", e.target.value)}
                />
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* ─── Kontak ─────────────────────────────────────────────────── */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-lg">Kontak</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldRow
              label="Telepon"
              value={employee.phoneNumber}
              isEditing={isEditing}
              editNode={
                <Input
                  className="rounded-xl"
                  value={form.phoneNumber}
                  onChange={(e) => handleChange("phoneNumber", e.target.value)}
                />
              }
            />
            <FieldRow label="Email" value={employee.email} isEditing={false} />
          </div>
        </CardContent>
      </Card>

      {/* ─── Alamat ─────────────────────────────────────────────────── */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-lg">Alamat</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldRow
              label="Alamat KTP"
              value={employee.ktpAddress}
              isEditing={isEditing}
              editNode={
                <Input
                  className="rounded-xl"
                  value={form.ktpAddress}
                  onChange={(e) => handleChange("ktpAddress", e.target.value)}
                />
              }
            />
            <FieldRow
              label="Alamat Domisili"
              value={employee.currentAddress}
              isEditing={isEditing}
              editNode={
                <Input
                  className="rounded-xl"
                  value={form.currentAddress}
                  onChange={(e) =>
                    handleChange("currentAddress", e.target.value)
                  }
                />
              }
            />
            <FieldRow
              label="Kota"
              value={employee.city}
              isEditing={isEditing}
              editNode={
                <Input
                  className="rounded-xl"
                  value={form.city}
                  onChange={(e) => handleChange("city", e.target.value)}
                />
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* ─── Kontak Darurat ─────────────────────────────────────────── */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-lg">Kontak Darurat</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldRow
              label="Nama"
              value={employee.emergencyContactName}
              isEditing={isEditing}
              editNode={
                <Input
                  className="rounded-xl"
                  value={form.emergencyContactName}
                  onChange={(e) =>
                    handleChange("emergencyContactName", e.target.value)
                  }
                />
              }
            />
            <FieldRow
              label="Hubungan"
              value={employee.emergencyContactRel}
              isEditing={isEditing}
              editNode={
                <Input
                  className="rounded-xl"
                  value={form.emergencyContactRel}
                  onChange={(e) =>
                    handleChange("emergencyContactRel", e.target.value)
                  }
                />
              }
            />
            <FieldRow
              label="Telepon"
              value={employee.emergencyContactPhone}
              isEditing={isEditing}
              editNode={
                <Input
                  className="rounded-xl"
                  value={form.emergencyContactPhone}
                  onChange={(e) =>
                    handleChange("emergencyContactPhone", e.target.value)
                  }
                />
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
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
