"use client";

import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Magnifer, Restart } from "@solar-icons/react";
import { useDepartments } from "@/hooks/use-departments";
import { usePositions } from "@/hooks/use-positions";

interface EmployeeFiltersProps {
  search: string;
  onSearchChange: (val: string) => void;
  departmentId: string;
  onDepartmentChange: (val: string) => void;
  positionId: string;
  onPositionChange: (val: string) => void;
  status: string;
  onStatusChange: (val: string) => void;
  employmentType: string;
  onEmploymentTypeChange: (val: string) => void;
  onReset: () => void;
}

const STATUS_OPTIONS = [
  { value: "all", label: "Semua Status" },
  { value: "active", label: "Aktif" },
  { value: "inactive", label: "Tidak Aktif" },
  { value: "suspended", label: "Suspended" },
];

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "all", label: "Semua Tipe" },
  { value: "permanent", label: "Permanent" },
  { value: "contract", label: "Kontrak" },
  { value: "probation", label: "Probation" },
  { value: "intern", label: "Magang" },
];

export function EmployeeFilters({
  search,
  onSearchChange,
  departmentId,
  onDepartmentChange,
  positionId,
  onPositionChange,
  status,
  onStatusChange,
  employmentType,
  onEmploymentTypeChange,
  onReset,
}: EmployeeFiltersProps) {
  const { data: departments } = useDepartments();
  const { data: positions } = usePositions();

  const hasActiveFilters =
    search !== "" ||
    departmentId !== "all" ||
    positionId !== "all" ||
    status !== "all" ||
    employmentType !== "all";

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSearchChange(e.target.value);
    },
    [onSearchChange]
  );

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Search */}
      <div className="relative min-w-60 flex-1">
        <Magnifer
          weight="BoldDuotone"
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          placeholder="Cari nama, email, NIK..."
          value={search}
          onChange={handleSearchChange}
          className="rounded-xl pl-9"
        />
      </div>

      {/* Department */}
      <Select value={departmentId} onValueChange={onDepartmentChange}>
        <SelectTrigger className="w-44 rounded-xl">
          <SelectValue placeholder="Departemen" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua Departemen</SelectItem>
          {departments?.map((dept) => (
            <SelectItem key={dept.id} value={dept.id}>
              {dept.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Position */}
      <Select value={positionId} onValueChange={onPositionChange}>
        <SelectTrigger className="w-44 rounded-xl">
          <SelectValue placeholder="Posisi" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua Posisi</SelectItem>
          {positions?.map((pos) => (
            <SelectItem key={pos.id} value={pos.id}>
              {pos.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status */}
      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="w-40 rounded-xl">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Employment Type */}
      <Select value={employmentType} onValueChange={onEmploymentTypeChange}>
        <SelectTrigger className="w-40 rounded-xl">
          <SelectValue placeholder="Tipe" />
        </SelectTrigger>
        <SelectContent>
          {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Reset */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="rounded-full"
        >
          <Restart weight="BoldDuotone" className="mr-1 h-4 w-4" />
          Reset
        </Button>
      )}
    </div>
  );
}
