"use client";

import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useHolidayTokenGrants,
  useGrantHolidayToken,
  useRevokeHolidayToken,
} from "@/hooks/use-holiday-token-grants";
import { useEmployees } from "@/hooks/use-employees";
import { usePublicHolidays } from "@/hooks/usePublicHoliday";
import { PermissionGate } from "@/components/shared/permission-gate";
import {
  AddCircle,
  TrashBinTrash,
  Ticket,
  AltArrowDown,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
} from "@solar-icons/react";
import { cn } from "@/lib/utils";

const PAGE_LIMIT = 20;

export function HolidayTokenManager() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useHolidayTokenGrants({
    page,
    limit: PAGE_LIMIT,
    search: search.trim() || undefined,
  });
  const grantMutation = useGrantHolidayToken();
  const revokeMutation = useRevokeHolidayToken();

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  // Grant dialog
  const [grantOpen, setGrantOpen] = useState(false);
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [selectedHolidayId, setSelectedHolidayId] = useState("");
  const [note, setNote] = useState("");

  const { data: employeeData } = useEmployees({
    search: employeeSearch || undefined,
    limit: 20,
    status: "active",
  });
  const employees = employeeData?.data ?? [];
  const selectedEmployee = employees.find((e) => e.id === selectedProfileId);

  const { data: holidays } = usePublicHolidays();
  const activeHolidays = useMemo(
    () => (holidays ?? []).filter((h) => h.isActive),
    [holidays],
  );

  const resetGrantForm = useCallback(() => {
    setSelectedProfileId("");
    setSelectedHolidayId("");
    setNote("");
    setEmployeeSearch("");
  }, []);

  const handleGrant = useCallback(() => {
    if (!selectedProfileId || !selectedHolidayId) {
      toast.error("Karyawan dan hari besar wajib dipilih");
      return;
    }

    grantMutation.mutate(
      {
        profileId: selectedProfileId,
        publicHolidayId: selectedHolidayId,
        note: note.trim() || undefined,
      },
      {
        onSuccess: (result) => {
          if (result.success) {
            toast.success("Token berhasil diberikan");
            setGrantOpen(false);
            resetGrantForm();
          } else {
            toast.error(result.error ?? "Gagal memberikan token");
          }
        },
        onError: () => toast.error("Terjadi kesalahan"),
      },
    );
  }, [selectedProfileId, selectedHolidayId, note, grantMutation, resetGrantForm]);

  // Revoke confirmation
  const [revokeTargetId, setRevokeTargetId] = useState<string | null>(null);

  const handleRevoke = useCallback(() => {
    if (!revokeTargetId) return;
    revokeMutation.mutate(
      { grantId: revokeTargetId },
      {
        onSuccess: (result) => {
          if (result.success) {
            toast.success("Token berhasil dibatalkan");
            setRevokeTargetId(null);
          } else {
            toast.error(result.error ?? "Gagal membatalkan token");
          }
        },
        onError: () => toast.error("Terjadi kesalahan"),
      },
    );
  }, [revokeTargetId, revokeMutation]);

  return (
    <>
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="font-heading text-lg">Token Hari Besar</CardTitle>
            <PermissionGate module="hr-leave" action="create">
              <Button
                onClick={() => setGrantOpen(true)}
                className="rounded-full gap-1.5"
              >
                <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                Berikan Token
              </Button>
            </PermissionGate>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1.5 sm:max-w-xs">
            <Label className="text-xs text-muted-foreground">Cari</Label>
            <Input
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Nama karyawan atau hari besar..."
              className="rounded-xl"
            />
          </div>

          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          )}

          {!isLoading && (data?.data.length ?? 0) === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Ticket
                weight="BoldDuotone"
                className="h-10 w-10 text-muted-foreground/40"
              />
              <p className="mt-3 text-sm text-muted-foreground">
                Belum ada token yang diberikan
              </p>
            </div>
          )}

          {!isLoading && (data?.data.length ?? 0) > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Karyawan</TableHead>
                    <TableHead>Hari Besar</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Diberikan Oleh</TableHead>
                    <TableHead>Catatan</TableHead>
                    <TableHead className="w-16">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.data.map((grant) => (
                    <TableRow key={grant.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{grant.profile.fullName}</p>
                          {grant.profile.employeeNumber && (
                            <p className="text-xs text-muted-foreground">
                              {grant.profile.employeeNumber}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{grant.publicHolidayName}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(grant.holidayDate).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        {grant.isUsed ? (
                          <Badge variant="outline">Terpakai</Badge>
                        ) : (
                          <Badge variant="secondary">Tersedia</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {grant.granter?.fullName ?? "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {grant.note ?? "-"}
                      </TableCell>
                      <TableCell>
                        <PermissionGate module="hr-leave" action="delete">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full"
                            onClick={() => setRevokeTargetId(grant.id)}
                            disabled={grant.isUsed}
                            title="Batalkan token"
                          >
                            <TrashBinTrash
                              weight="BoldDuotone"
                              className="h-3.5 w-3.5 text-destructive"
                            />
                          </Button>
                        </PermissionGate>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ArrowLeft weight="BoldDuotone" className="mr-1 h-4 w-4" />
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
                <ArrowRight weight="BoldDuotone" className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grant Dialog */}
      <Dialog
        open={grantOpen}
        onOpenChange={(open) => {
          setGrantOpen(open);
          if (!open) resetGrantForm();
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Berikan Token Hari Besar</DialogTitle>
            <DialogDescription>
              Pilih karyawan dan hari besar untuk memberikan token cuti redemption.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Karyawan</Label>
              <Popover open={employeeOpen} onOpenChange={setEmployeeOpen}>
                <PopoverTrigger
                  role="combobox"
                  aria-expanded={employeeOpen}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "w-full rounded-xl justify-between font-normal",
                  )}
                >
                  <span className={cn("truncate", !selectedProfileId && "text-muted-foreground")}>
                    {selectedProfileId && selectedEmployee
                      ? (selectedEmployee.fullName ?? selectedEmployee.email)
                      : "Pilih karyawan..."}
                  </span>
                  <AltArrowDown weight="BoldDuotone" className="h-4 w-4 shrink-0 opacity-50" />
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Cari karyawan..."
                      value={employeeSearch}
                      onValueChange={setEmployeeSearch}
                    />
                    <CommandList>
                      <CommandEmpty>Karyawan tidak ditemukan</CommandEmpty>
                      <CommandGroup>
                        {employees.map((emp) => (
                          <CommandItem
                            key={emp.id}
                            value={emp.id}
                            onSelect={(val) => {
                              setSelectedProfileId(val);
                              setEmployeeOpen(false);
                            }}
                          >
                            <CheckCircle
                              weight="BoldDuotone"
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedProfileId === emp.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {emp.fullName ?? emp.email}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid gap-2">
              <Label>Hari Besar</Label>
              <Select value={selectedHolidayId} onValueChange={setSelectedHolidayId}>
                <SelectTrigger className="rounded-xl w-full">
                  <SelectValue placeholder="Pilih hari besar..." />
                </SelectTrigger>
                <SelectContent>
                  {activeHolidays.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name} (
                      {new Date(h.date).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                      )
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="grant-note">Catatan (opsional)</Label>
              <Textarea
                id="grant-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Tulis catatan..."
                className="rounded-xl"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setGrantOpen(false)}
              disabled={grantMutation.isPending}
            >
              Batal
            </Button>
            <Button
              className="rounded-full"
              onClick={handleGrant}
              disabled={grantMutation.isPending}
            >
              {grantMutation.isPending ? "Menyimpan..." : "Berikan Token"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation */}
      <Dialog
        open={revokeTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeTargetId(null);
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Batalkan Token</DialogTitle>
            <DialogDescription>
              Token ini akan dihapus dan karyawan tidak lagi bisa mengajukan cuti
              redemption untuk hari besar ini. Tindakan tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setRevokeTargetId(null)}
              disabled={revokeMutation.isPending}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              className="rounded-full"
              onClick={handleRevoke}
              disabled={revokeMutation.isPending}
            >
              {revokeMutation.isPending ? "Memproses..." : "Batalkan Token"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
