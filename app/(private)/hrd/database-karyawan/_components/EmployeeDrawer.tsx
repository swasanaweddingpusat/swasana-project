"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Drawer } from "@/components/shared/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { AltArrowDown, AltArrowRight } from "@solar-icons/react";
import { useDepartments } from "@/hooks/use-departments";
import { usePositions } from "@/hooks/use-positions";
import { useCreateEmployee, useUpdateEmployee } from "@/hooks/use-employees";
import { createEmployeeSchema, updateEmployeeSchema } from "@/lib/validations/employee";
import type { EmployeeListItem } from "@/lib/queries/employees";

// ─── Types ───────────────────────────────────────────────────────────────────

interface EmployeeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editEmployee?: EmployeeListItem | null;
}

interface RoleOption {
  id: string;
  name: string;
}

interface ManagerOption {
  id: string;
  fullName: string | null;
}

// ─── Form state ──────────────────────────────────────────────────────────────

interface FormState {
  fullName: string;
  nickName: string;
  email: string;
  phoneNumber: string;
  gender: string;
  departmentId: string;
  positionId: string;
  roleId: string;
  managerId: string;
  employmentType: string;
  joinDate: string;
  contractStartDate: string;
  contractEndDate: string;
  dataScope: string;
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
  ktpAddress: string;
  currentAddress: string;
  city: string;
  emergencyContactName: string;
  emergencyContactRel: string;
  emergencyContactPhone: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  npwp: string;
  bpjsKesehatan: string;
  bpjsKetenagakerjaan: string;
}

const EMPTY_FORM: FormState = {
  fullName: "",
  nickName: "",
  email: "",
  phoneNumber: "",
  gender: "",
  departmentId: "",
  positionId: "",
  roleId: "",
  managerId: "",
  employmentType: "",
  joinDate: "",
  contractStartDate: "",
  contractEndDate: "",
  dataScope: "own",
  nik: "",
  kkNumber: "",
  placeOfBirth: "",
  dateOfBirth: "",
  religion: "",
  bloodType: "",
  maritalStatus: "",
  numberOfChildren: "",
  lastEducation: "",
  motherName: "",
  ktpAddress: "",
  currentAddress: "",
  city: "",
  emergencyContactName: "",
  emergencyContactRel: "",
  emergencyContactPhone: "",
  bankName: "",
  bankAccountNumber: "",
  bankAccountHolder: "",
  npwp: "",
  bpjsKesehatan: "",
  bpjsKetenagakerjaan: "",
};

// ─── Constants ───────────────────────────────────────────────────────────────

const GENDER_OPTIONS = [
  { value: "MALE", label: "Laki-laki" },
  { value: "FEMALE", label: "Perempuan" },
];

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "permanent", label: "Permanent" },
  { value: "contract", label: "Kontrak" },
  { value: "probation", label: "Probation" },
  { value: "intern", label: "Magang" },
];

const DATA_SCOPE_OPTIONS = [
  { value: "own", label: "Own" },
  { value: "group", label: "Group" },
  { value: "all", label: "All" },
];

const RELIGION_OPTIONS = [
  { value: "islam", label: "Islam" },
  { value: "kristen", label: "Kristen" },
  { value: "katolik", label: "Katolik" },
  { value: "hindu", label: "Hindu" },
  { value: "buddha", label: "Buddha" },
  { value: "konghucu", label: "Konghucu" },
];

const BLOOD_TYPE_OPTIONS = [
  { value: "A", label: "A" },
  { value: "B", label: "B" },
  { value: "AB", label: "AB" },
  { value: "O", label: "O" },
];

const MARITAL_STATUS_OPTIONS = [
  { value: "single", label: "Belum Menikah" },
  { value: "married", label: "Menikah" },
  { value: "divorced", label: "Cerai Hidup" },
  { value: "widowed", label: "Cerai Mati" },
];

const EDUCATION_OPTIONS = [
  { value: "sd", label: "SD" },
  { value: "smp", label: "SMP" },
  { value: "sma", label: "SMA/SMK" },
  { value: "d1", label: "D1" },
  { value: "d2", label: "D2" },
  { value: "d3", label: "D3" },
  { value: "d4", label: "D4" },
  { value: "s1", label: "S1" },
  { value: "s2", label: "S2" },
  { value: "s3", label: "S3" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dateToInputValue(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

function buildFormFromEmployee(emp: EmployeeListItem): FormState {
  return {
    fullName: emp.fullName ?? "",
    nickName: "",
    email: emp.email ?? "",
    phoneNumber: emp.phoneNumber ?? "",
    gender: "",
    departmentId: emp.department?.id ?? "",
    positionId: emp.position?.id ?? "",
    roleId: "",
    managerId: "",
    employmentType: emp.employmentType ?? "",
    joinDate: dateToInputValue(emp.joinDate),
    contractStartDate: "",
    contractEndDate: "",
    dataScope: "own",
    nik: "",
    kkNumber: "",
    placeOfBirth: "",
    dateOfBirth: "",
    religion: "",
    bloodType: "",
    maritalStatus: "",
    numberOfChildren: "",
    lastEducation: "",
    motherName: "",
    ktpAddress: "",
    currentAddress: "",
    city: "",
    emergencyContactName: "",
    emergencyContactRel: "",
    emergencyContactPhone: "",
    bankName: "",
    bankAccountNumber: "",
    bankAccountHolder: "",
    npwp: "",
    bpjsKesehatan: "",
    bpjsKetenagakerjaan: "",
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function EmployeeDrawer({
  open,
  onOpenChange,
  editEmployee,
}: EmployeeDrawerProps) {
  const isEdit = !!editEmployee;
  const [form, setForm] = useState<FormState>(() =>
    editEmployee ? buildFormFromEmployee(editEmployee) : EMPTY_FORM
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Section open state
  const [basicOpen, setBasicOpen] = useState(true);
  const [employmentOpen, setEmploymentOpen] = useState(!!editEmployee);
  const [personalOpen, setPersonalOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);

  // Data hooks
  const { data: departments } = useDepartments();
  const { data: positions } = usePositions(
    form.departmentId || undefined
  );
  const { data: roles = [] } = useQuery<RoleOption[]>({
    queryKey: ["roles"],
    queryFn: async () => {
      const res = await fetch("/api/roles");
      if (!res.ok) return [];
      return (await res.json()) as RoleOption[];
    },
    staleTime: 5 * 60_000,
  });
  const { data: managers = [] } = useQuery<ManagerOption[]>({
    queryKey: ["managers"],
    queryFn: async () => {
      const res = await fetch("/api/managers");
      if (!res.ok) return [];
      return (await res.json()) as ManagerOption[];
    },
    staleTime: 5 * 60_000,
  });

  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();
  const isPending = createMutation.isPending || updateMutation.isPending;

  // ─── Field updater ─────────────────────────────────────────────────────

  const updateField = useCallback(
    (field: keyof FormState) => (value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => {
        if (prev[field]) {
          const next = { ...prev };
          delete next[field];
          return next;
        }
        return prev;
      });
    },
    []
  );

  const handleInputChange = useCallback(
    (field: keyof FormState) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        updateField(field)(e.target.value);
      },
    [updateField]
  );

  // ─── Section opener for validation errors ───────────────────────────

  const openSectionForField = useCallback((field: string): void => {
    const basicFields = ["fullName", "nickName", "email", "phoneNumber", "gender"];
    const employmentFields = ["departmentId", "positionId", "roleId", "managerId", "employmentType", "joinDate", "contractStartDate", "contractEndDate", "dataScope"];
    const personalFields = ["nik", "kkNumber", "placeOfBirth", "dateOfBirth", "religion", "bloodType", "maritalStatus", "numberOfChildren", "lastEducation", "motherName"];
    const addressFields = ["ktpAddress", "currentAddress", "city"];
    const emergencyFields = ["emergencyContactName", "emergencyContactRel", "emergencyContactPhone"];
    const bankFields = ["bankName", "bankAccountNumber", "bankAccountHolder", "npwp", "bpjsKesehatan", "bpjsKetenagakerjaan"];

    if (basicFields.includes(field)) setBasicOpen(true);
    if (employmentFields.includes(field)) setEmploymentOpen(true);
    if (personalFields.includes(field)) setPersonalOpen(true);
    if (addressFields.includes(field)) setAddressOpen(true);
    if (emergencyFields.includes(field)) setEmergencyOpen(true);
    if (bankFields.includes(field)) setBankOpen(true);
  }, []);

  // ─── Submit ────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      // Build payload — convert empty strings to undefined
      const payload: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(form)) {
        if (key === "numberOfChildren") {
          if (value !== "") {
            payload[key] = Number(value);
          }
          continue;
        }
        if (key === "joinDate" || key === "dateOfBirth" || key === "contractStartDate" || key === "contractEndDate") {
          if (value) {
            payload[key] = new Date(value as string);
          }
          continue;
        }
        if (value !== "") {
          payload[key] = value;
        }
      }

      // Validate
      const schema = isEdit ? updateEmployeeSchema : createEmployeeSchema;
      const result = schema.safeParse(payload);
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of result.error.issues) {
          const field = issue.path[0];
          if (field && !fieldErrors[String(field)]) {
            fieldErrors[String(field)] = issue.message;
          }
        }
        setErrors(fieldErrors);
        // Open the section containing the first error
        const firstErrorField = result.error.issues[0]?.path[0];
        if (firstErrorField) {
          openSectionForField(String(firstErrorField));
        }
        return;
      }

      if (isEdit && editEmployee) {
        updateMutation.mutate(
          { id: editEmployee.id, data: payload },
          {
            onSuccess: (res) => {
              if (res.success) {
                toast.success("Data karyawan berhasil diperbarui");
                onOpenChange(false);
              } else {
                toast.error(res.error ?? "Gagal memperbarui data");
              }
            },
            onError: () => {
              toast.error("Terjadi kesalahan");
            },
          }
        );
      } else {
        createMutation.mutate(payload, {
          onSuccess: (res) => {
            if (res.success) {
              toast.success(res.message ?? "Karyawan berhasil ditambahkan");
              onOpenChange(false);
            } else {
              toast.error(res.error ?? "Gagal menambahkan karyawan");
            }
          },
          onError: () => {
            toast.error("Terjadi kesalahan");
          },
        });
      }
    },
    [form, isEdit, editEmployee, createMutation, updateMutation, onOpenChange, openSectionForField]
  );

  const showContractDates = form.employmentType === "contract";

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <Drawer
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title={isEdit ? "Edit Karyawan" : "Tambah Karyawan"}
      maxWidth="sm:max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-1">
        {/* ─── Section: Informasi Dasar ──────────────────────────────── */}
        <SectionCollapsible
          title="Informasi Dasar"
          open={basicOpen}
          onOpenChange={setBasicOpen}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldInput
              label="Nama Lengkap"
              value={form.fullName}
              onChange={handleInputChange("fullName")}
              error={errors.fullName}
              required
            />
            <FieldInput
              label="Nama Panggilan"
              value={form.nickName}
              onChange={handleInputChange("nickName")}
              error={errors.nickName}
            />
            {!isEdit && (
              <FieldInput
                label="Email"
                type="email"
                value={form.email}
                onChange={handleInputChange("email")}
                error={errors.email}
                required
              />
            )}
            <FieldInput
              label="No. Telepon"
              value={form.phoneNumber}
              onChange={handleInputChange("phoneNumber")}
              error={errors.phoneNumber}
            />
            <FieldSelect
              label="Jenis Kelamin"
              value={form.gender}
              onValueChange={updateField("gender")}
              options={GENDER_OPTIONS}
              placeholder="Pilih"
              error={errors.gender}
            />
          </div>
        </SectionCollapsible>

        {/* ─── Section: Data Kepegawaian ─────────────────────────────── */}
        <SectionCollapsible
          title="Data Kepegawaian"
          open={employmentOpen}
          onOpenChange={setEmploymentOpen}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldSelect
              label="Departemen"
              value={form.departmentId}
              onValueChange={(v) => {
                updateField("departmentId")(v);
                updateField("positionId")("");
              }}
              options={
                departments?.map((d) => ({ value: d.id, label: d.name })) ?? []
              }
              placeholder="Pilih Departemen"
              error={errors.departmentId}
            />
            <FieldSelect
              label="Posisi"
              value={form.positionId}
              onValueChange={updateField("positionId")}
              options={
                positions?.map((p) => ({ value: p.id, label: p.name })) ?? []
              }
              placeholder="Pilih Posisi"
              error={errors.positionId}
            />
            <FieldSelect
              label="Role"
              value={form.roleId}
              onValueChange={updateField("roleId")}
              options={roles.map((r) => ({ value: r.id, label: r.name }))}
              placeholder="Pilih Role"
              error={errors.roleId}
            />
            <FieldSelect
              label="Atasan Langsung"
              value={form.managerId}
              onValueChange={updateField("managerId")}
              options={managers.map((m) => ({
                value: m.id,
                label: m.fullName ?? "-",
              }))}
              placeholder="Pilih Atasan"
              error={errors.managerId}
            />
            <FieldSelect
              label="Tipe Kepegawaian"
              value={form.employmentType}
              onValueChange={updateField("employmentType")}
              options={EMPLOYMENT_TYPE_OPTIONS}
              placeholder="Pilih Tipe"
              error={errors.employmentType}
            />
            <FieldInput
              label="Tanggal Masuk"
              type="date"
              value={form.joinDate}
              onChange={handleInputChange("joinDate")}
              error={errors.joinDate}
            />
            {showContractDates && (
              <>
                <FieldInput
                  label="Mulai Kontrak"
                  type="date"
                  value={form.contractStartDate}
                  onChange={handleInputChange("contractStartDate")}
                  error={errors.contractStartDate}
                />
                <FieldInput
                  label="Selesai Kontrak"
                  type="date"
                  value={form.contractEndDate}
                  onChange={handleInputChange("contractEndDate")}
                  error={errors.contractEndDate}
                />
              </>
            )}
            <FieldSelect
              label="Data Scope"
              value={form.dataScope}
              onValueChange={updateField("dataScope")}
              options={DATA_SCOPE_OPTIONS}
              placeholder="Pilih Scope"
              error={errors.dataScope}
            />
          </div>
        </SectionCollapsible>

        {/* ─── Section: Data Pribadi ──────────────────────────────────── */}
        <SectionCollapsible
          title="Data Pribadi"
          open={personalOpen}
          onOpenChange={setPersonalOpen}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldInput
              label="NIK"
              value={form.nik}
              onChange={handleInputChange("nik")}
              error={errors.nik}
            />
            <FieldInput
              label="No. KK"
              value={form.kkNumber}
              onChange={handleInputChange("kkNumber")}
              error={errors.kkNumber}
            />
            <FieldInput
              label="Tempat Lahir"
              value={form.placeOfBirth}
              onChange={handleInputChange("placeOfBirth")}
              error={errors.placeOfBirth}
            />
            <FieldInput
              label="Tanggal Lahir"
              type="date"
              value={form.dateOfBirth}
              onChange={handleInputChange("dateOfBirth")}
              error={errors.dateOfBirth}
            />
            <FieldSelect
              label="Agama"
              value={form.religion}
              onValueChange={updateField("religion")}
              options={RELIGION_OPTIONS}
              placeholder="Pilih Agama"
              error={errors.religion}
            />
            <FieldSelect
              label="Golongan Darah"
              value={form.bloodType}
              onValueChange={updateField("bloodType")}
              options={BLOOD_TYPE_OPTIONS}
              placeholder="Pilih"
              error={errors.bloodType}
            />
            <FieldSelect
              label="Status Pernikahan"
              value={form.maritalStatus}
              onValueChange={updateField("maritalStatus")}
              options={MARITAL_STATUS_OPTIONS}
              placeholder="Pilih"
              error={errors.maritalStatus}
            />
            <FieldInput
              label="Jumlah Anak"
              type="number"
              value={form.numberOfChildren}
              onChange={handleInputChange("numberOfChildren")}
              error={errors.numberOfChildren}
            />
            <FieldSelect
              label="Pendidikan Terakhir"
              value={form.lastEducation}
              onValueChange={updateField("lastEducation")}
              options={EDUCATION_OPTIONS}
              placeholder="Pilih"
              error={errors.lastEducation}
            />
            <FieldInput
              label="Nama Ibu Kandung"
              value={form.motherName}
              onChange={handleInputChange("motherName")}
              error={errors.motherName}
            />
          </div>
        </SectionCollapsible>

        {/* ─── Section: Alamat ────────────────────────────────────────── */}
        <SectionCollapsible
          title="Alamat"
          open={addressOpen}
          onOpenChange={setAddressOpen}
        >
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Alamat KTP</Label>
              <textarea
                className="flex min-h-20 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.ktpAddress}
                onChange={handleInputChange("ktpAddress")}
              />
              {errors.ktpAddress && (
                <p className="text-xs text-destructive">{errors.ktpAddress}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Alamat Domisili</Label>
              <textarea
                className="flex min-h-20 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.currentAddress}
                onChange={handleInputChange("currentAddress")}
              />
              {errors.currentAddress && (
                <p className="text-xs text-destructive">
                  {errors.currentAddress}
                </p>
              )}
            </div>
            <FieldInput
              label="Kota"
              value={form.city}
              onChange={handleInputChange("city")}
              error={errors.city}
            />
          </div>
        </SectionCollapsible>

        {/* ─── Section: Kontak Darurat ────────────────────────────────── */}
        <SectionCollapsible
          title="Kontak Darurat"
          open={emergencyOpen}
          onOpenChange={setEmergencyOpen}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldInput
              label="Nama Kontak Darurat"
              value={form.emergencyContactName}
              onChange={handleInputChange("emergencyContactName")}
              error={errors.emergencyContactName}
            />
            <FieldInput
              label="Hubungan"
              value={form.emergencyContactRel}
              onChange={handleInputChange("emergencyContactRel")}
              error={errors.emergencyContactRel}
            />
            <FieldInput
              label="No. Telepon Darurat"
              value={form.emergencyContactPhone}
              onChange={handleInputChange("emergencyContactPhone")}
              error={errors.emergencyContactPhone}
            />
          </div>
        </SectionCollapsible>

        {/* ─── Section: Data Bank & Pajak ─────────────────────────────── */}
        <SectionCollapsible
          title="Data Bank & Pajak"
          open={bankOpen}
          onOpenChange={setBankOpen}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldInput
              label="Nama Bank"
              value={form.bankName}
              onChange={handleInputChange("bankName")}
              error={errors.bankName}
            />
            <FieldInput
              label="No. Rekening"
              value={form.bankAccountNumber}
              onChange={handleInputChange("bankAccountNumber")}
              error={errors.bankAccountNumber}
            />
            <FieldInput
              label="Atas Nama Rekening"
              value={form.bankAccountHolder}
              onChange={handleInputChange("bankAccountHolder")}
              error={errors.bankAccountHolder}
            />
            <FieldInput
              label="NPWP"
              value={form.npwp}
              onChange={handleInputChange("npwp")}
              error={errors.npwp}
            />
            <FieldInput
              label="BPJS Kesehatan"
              value={form.bpjsKesehatan}
              onChange={handleInputChange("bpjsKesehatan")}
              error={errors.bpjsKesehatan}
            />
            <FieldInput
              label="BPJS Ketenagakerjaan"
              value={form.bpjsKetenagakerjaan}
              onChange={handleInputChange("bpjsKetenagakerjaan")}
              error={errors.bpjsKetenagakerjaan}
            />
          </div>
        </SectionCollapsible>

        {/* ─── Submit ─────────────────────────────────────────────────── */}
        <div className="sticky bottom-0 bg-background pt-4 pb-2">
          <Button
            type="submit"
            className="w-full rounded-full"
            disabled={isPending}
          >
            {isPending
              ? "Memproses..."
              : isEdit
                ? "Simpan Perubahan"
                : "Tambah Karyawan"}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionCollapsible({
  title,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl bg-muted/50 px-4 py-3 text-left transition-colors hover:bg-muted">
        <span className="text-sm font-semibold">{title}</span>
        {open ? (
          <AltArrowDown
            weight="BoldDuotone"
            className="h-4 w-4 text-muted-foreground"
          />
        ) : (
          <AltArrowRight
            weight="BoldDuotone"
            className="h-4 w-4 text-muted-foreground"
          />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-1 pt-4 pb-2">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function FieldInput({
  label,
  type = "text",
  value,
  onChange,
  error,
  required,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={onChange}
        className={`rounded-xl ${error ? "border-destructive" : ""}`}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function FieldSelect({
  label,
  value,
  onValueChange,
  options,
  placeholder,
  error,
}: {
  label: string;
  value: string;
  onValueChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={`rounded-xl ${error ? "border-destructive" : ""}`}>
          <SelectValue placeholder={placeholder ?? "Pilih"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
