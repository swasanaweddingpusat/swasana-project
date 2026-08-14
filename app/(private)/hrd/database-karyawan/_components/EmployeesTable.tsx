"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PermissionGate } from "@/components/shared/permission-gate";
import { EmployeeFilters } from "./EmployeeFilters";
import { EmployeeDrawer } from "./EmployeeDrawer";
import { DepartmentManager } from "./DepartmentManager";
import { PositionManager } from "./PositionManager";
import { OrgChart } from "./OrgChart";
import { useEmployees, useDeleteEmployee } from "@/hooks/use-employees";
import {
  AddCircle,
  ArrowLeft,
  ArrowRight,
  Eye,
  Pen,
  TrashBinTrash,
  FileDownload,
  UsersGroupRounded,
  Buildings3,
  Structure,
  UserRounded,
} from "@solar-icons/react";
import type { EmployeeListItem } from "@/lib/queries/employees";

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  active: { label: "Aktif", variant: "default" },
  inactive: { label: "Tidak Aktif", variant: "secondary" },
  suspended: { label: "Suspended", variant: "destructive" },
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  permanent: "Permanent",
  contract: "Kontrak",
  probation: "Probation",
  intern: "Magang",
};

const DEBOUNCE_MS = 400;
const PAGE_SIZE = 20;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

function formatDate(date: string | Date | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── useDebounce ─────────────────────────────────────────────────────────────

function useDebounce(value: string, delay: number): string {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function EmployeesTable() {
  // Filter state
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("all");
  const [positionId, setPositionId] = useState("all");
  const [status, setStatus] = useState("all");
  const [employmentType, setEmploymentType] = useState("all");
  const [page, setPage] = useState(1);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeListItem | null>(null);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<EmployeeListItem | null>(null);

  // Debounced search
  const debouncedSearch = useDebounce(search, DEBOUNCE_MS);

  // Build query params
  const queryParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      departmentId: departmentId !== "all" ? departmentId : undefined,
      positionId: positionId !== "all" ? positionId : undefined,
      status: status !== "all" ? status : undefined,
      employmentType: employmentType !== "all" ? employmentType : undefined,
    }),
    [page, debouncedSearch, departmentId, positionId, status, employmentType]
  );

  const { data, isLoading } = useEmployees(queryParams);
  const deleteMutation = useDeleteEmployee();

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setSearch("");
    setDepartmentId("all");
    setPositionId("all");
    setStatus("all");
    setEmploymentType("all");
    setPage(1);
  }, []);

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    setPage(1);
  }, []);

  const handleDepartmentChange = useCallback((val: string) => {
    setDepartmentId(val);
    setPage(1);
  }, []);

  const handlePositionChange = useCallback((val: string) => {
    setPositionId(val);
    setPage(1);
  }, []);

  const handleStatusChange = useCallback((val: string) => {
    setStatus(val);
    setPage(1);
  }, []);

  const handleEmploymentTypeChange = useCallback((val: string) => {
    setEmploymentType(val);
    setPage(1);
  }, []);

  const handleOpenCreate = useCallback(() => {
    setEditingEmployee(null);
    setDrawerOpen(true);
  }, []);

  const handleOpenEdit = useCallback((employee: EmployeeListItem) => {
    setEditingEmployee(employee);
    setDrawerOpen(true);
  }, []);

  const handleDrawerClose = useCallback((open: boolean) => {
    setDrawerOpen(open);
    if (!open) {
      setEditingEmployee(null);
    }
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: (result) => {
        if (result.success) {
          toast.success("Karyawan berhasil dinonaktifkan");
        } else {
          toast.error(result.error ?? "Gagal menghapus karyawan");
        }
        setDeleteTarget(null);
      },
      onError: () => {
        toast.error("Terjadi kesalahan");
        setDeleteTarget(null);
      },
    });
  }, [deleteTarget, deleteMutation]);

  const handleExport = useCallback(() => {
    const sp = new URLSearchParams();
    if (departmentId !== "all") sp.set("departmentId", departmentId);
    if (status !== "all") sp.set("status", status);
    const queryString = sp.toString();
    const url = `/api/hr/employees/export${queryString ? `?${queryString}` : ""}`;
    window.open(url, "_blank");
  }, [departmentId, status]);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      <Tabs defaultValue="karyawan" className="w-full">
        <TabsList className="rounded-xl">
          <TabsTrigger value="karyawan" className="rounded-xl gap-1.5">
            <UsersGroupRounded weight="BoldDuotone" className="h-4 w-4" />
            Karyawan
          </TabsTrigger>
          <TabsTrigger value="departemen" className="rounded-xl gap-1.5">
            <Buildings3 weight="BoldDuotone" className="h-4 w-4" />
            Departemen
          </TabsTrigger>
          <TabsTrigger value="posisi" className="rounded-xl gap-1.5">
            <UserRounded weight="BoldDuotone" className="h-4 w-4" />
            Posisi
          </TabsTrigger>
          <TabsTrigger value="orgchart" className="rounded-xl gap-1.5">
            <Structure weight="BoldDuotone" className="h-4 w-4" />
            Org Chart
          </TabsTrigger>
        </TabsList>

        {/* ─── Karyawan Tab ────────────────────────────────────────────── */}
        <TabsContent value="karyawan" className="mt-4 space-y-4">
          {/* Action bar */}
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="pt-5">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <EmployeeFilters
                    search={search}
                    onSearchChange={handleSearchChange}
                    departmentId={departmentId}
                    onDepartmentChange={handleDepartmentChange}
                    positionId={positionId}
                    onPositionChange={handlePositionChange}
                    status={status}
                    onStatusChange={handleStatusChange}
                    employmentType={employmentType}
                    onEmploymentTypeChange={handleEmploymentTypeChange}
                    onReset={handleReset}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <PermissionGate module="hr" action="create">
                    <Button
                      onClick={handleOpenCreate}
                      className="rounded-full gap-1.5"
                    >
                      <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                      Tambah Karyawan
                    </Button>
                  </PermissionGate>
                  <PermissionGate module="hr" action="view">
                    <Button
                      variant="outline"
                      onClick={handleExport}
                      className="rounded-full gap-1.5"
                    >
                      <FileDownload weight="BoldDuotone" className="h-4 w-4" />
                      Export CSV
                    </Button>
                  </PermissionGate>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="font-heading text-lg">
                  Daftar Karyawan
                </CardTitle>
                {data && (
                  <span className="text-sm text-muted-foreground">
                    {data.total} karyawan
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Loading */}
              {isLoading && (
                <div className="space-y-2">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              )}

              {/* Empty */}
              {!isLoading && (!data || data.data.length === 0) && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <UsersGroupRounded
                    weight="BoldDuotone"
                    className="h-12 w-12 text-muted-foreground/40"
                  />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Tidak ada data karyawan ditemukan
                  </p>
                </div>
              )}

              {/* Data */}
              {!isLoading && data && data.data.length > 0 && (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="hidden w-12 sm:table-cell">No</TableHead>
                          <TableHead>Karyawan</TableHead>
                          <TableHead className="hidden sm:table-cell">Departemen</TableHead>
                          <TableHead className="hidden sm:table-cell">Posisi</TableHead>
                          <TableHead className="hidden sm:table-cell">Tipe</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="hidden sm:table-cell">Tgl Masuk</TableHead>
                          <TableHead className="w-28 text-center">
                            Aksi
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.data.map((emp, idx) => {
                          const rowNum =
                            (data.page - 1) * data.limit + idx + 1;
                          const statusBadge =
                            STATUS_BADGE[emp.status] ?? STATUS_BADGE.active;
                          const empTypeLabel = emp.employmentType
                            ? EMPLOYMENT_LABELS[emp.employmentType] ??
                              emp.employmentType
                            : "-";

                          return (
                            <TableRow key={emp.id}>
                              <TableCell className="hidden text-muted-foreground sm:table-cell">
                                {rowNum}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage
                                      src={emp.avatarUrl ?? undefined}
                                      alt={emp.fullName ?? ""}
                                    />
                                    <AvatarFallback className="text-xs">
                                      {getInitials(emp.fullName ?? "?")}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">
                                      {emp.fullName}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      {emp.email}
                                    </p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="hidden text-sm sm:table-cell">
                                {emp.department?.name ?? "-"}
                              </TableCell>
                              <TableCell className="hidden text-sm sm:table-cell">
                                {emp.position?.name ?? "-"}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                <Badge variant="outline" className="rounded-full">
                                  {empTypeLabel}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={statusBadge.variant} className="rounded-full">
                                  {statusBadge.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="hidden text-sm sm:table-cell">
                                {formatDate(emp.joinDate)}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-center gap-1">
                                  <Link
                                    href={`/hrd/database-karyawan/${emp.id}`}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                                  >
                                    <Eye
                                      weight="BoldDuotone"
                                      className="h-4 w-4"
                                    />
                                  </Link>
                                  <PermissionGate
                                    module="hr"
                                    action="edit"
                                  >
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 rounded-full"
                                      onClick={() => handleOpenEdit(emp)}
                                    >
                                      <Pen
                                        weight="BoldDuotone"
                                        className="h-4 w-4"
                                      />
                                    </Button>
                                  </PermissionGate>
                                  <PermissionGate
                                    module="hr"
                                    action="delete"
                                  >
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 rounded-full text-destructive hover:text-destructive"
                                      onClick={() => setDeleteTarget(emp)}
                                    >
                                      <TrashBinTrash
                                        weight="BoldDuotone"
                                        className="h-4 w-4"
                                      />
                                    </Button>
                                  </PermissionGate>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-3 pt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        <ArrowLeft
                          weight="BoldDuotone"
                          className="mr-1 h-4 w-4"
                        />
                        Prev
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Hal. {page} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next
                        <ArrowRight
                          weight="BoldDuotone"
                          className="ml-1 h-4 w-4"
                        />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Departemen Tab ──────────────────────────────────────────── */}
        <TabsContent value="departemen" className="mt-4">
          <DepartmentManager />
        </TabsContent>

        {/* ─── Posisi Tab ──────────────────────────────────────────────── */}
        <TabsContent value="posisi" className="mt-4">
          <PositionManager />
        </TabsContent>

        {/* ─── Org Chart Tab ──────────────────────────────────────────── */}
        <TabsContent value="orgchart" className="mt-4">
          <OrgChart />
        </TabsContent>
      </Tabs>

      {/* ─── Employee Drawer ──────────────────────────────────────────── */}
      <EmployeeDrawer
        key={editingEmployee?.id ?? "create"}
        open={drawerOpen}
        onOpenChange={handleDrawerClose}
        editEmployee={editingEmployee}
      />

      {/* ─── Delete Confirmation Dialog ──────────────────────────────── */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">
              Nonaktifkan Karyawan
            </DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menonaktifkan{" "}
              <span className="font-semibold">{deleteTarget?.fullName}</span>?
              Status karyawan akan diubah menjadi tidak aktif.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setDeleteTarget(null)}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              className="rounded-full"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Memproses..." : "Nonaktifkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
