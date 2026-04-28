"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PencilIcon, Trash2, Plus, Users, ArrowLeft, ArrowRight, Search, Copy, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { PermissionGate } from "@/components/shared/permission-gate";
import { useCustomers, useDeleteCustomer } from "@/hooks/use-customers";
import { parseMobileNumbers, type MobileNumberEntry } from "@/lib/validations/customer";
import { CustomerDrawer } from "./customer-drawer";
import type { CustomerItem, CustomersResult } from "@/lib/queries/customers";

function formatMobileNumbers(raw: unknown): string {
  const entries = parseMobileNumbers(raw);
  return entries.map((e) => e.name ? `${e.name}: ${e.number}` : e.number).join(", ");
}

function mobileNumbersSearchable(raw: unknown): string {
  const entries = parseMobileNumbers(raw);
  return entries.map((e) => `${e.name} ${e.number}`).join(" ").toLowerCase();
}

const ROWS_PER_PAGE = 10;

const MEMBER_STATUS_COLORS: Record<string, string> = {
  "VIP": "bg-primary text-primary-foreground",
  "Member": "bg-secondary text-secondary-foreground",
  "Non-Member": "bg-muted text-muted-foreground",
};

export function CustomersTable({ initialData }: { initialData: CustomersResult }) {
  const { data: customers = initialData } = useCustomers(initialData);
  const deleteMut = useDeleteCustomer();

  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const qc = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<CustomerItem | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  function handleDrawerClose(open: boolean) {
    setDrawerOpen(open);
    if (!open) qc.invalidateQueries({ queryKey: ["customers"] });
  }
  const [deleteTarget, setDeleteTarget] = useState<CustomerItem | null>(null);

  const filtered = customers.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      mobileNumbersSearchable(c.mobileNumber).includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.type ?? "").toLowerCase().includes(q) ||
      (c.club ?? "").toLowerCase().includes(q) ||
      (c.memberStatus ?? "").toLowerCase().includes(q) ||
      (c.notes ?? "").toLowerCase().includes(q) ||
      (c.updatedBy ?? "").toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / ROWS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  function handleEdit(customer: CustomerItem) {
    setEditCustomer(customer);
    setDrawerOpen(true);
  }

  function handleAdd() {
    setEditCustomer(null);
    setDrawerOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteMut.mutateAsync(deleteTarget.id);
    if (!result.success) { toast.error(result.error); }
    else { toast.success("Customer dihapus."); }
    setDeleteTarget(null);
  }

  return (
    <>
      <Card>
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pb-4 border-b">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-foreground">List Customers</h2>
              <span className="text-xs font-medium bg-gray-50 text-gray-600 px-3 py-1 border border-gray-200 rounded-full">
                {filtered.length} {search ? `dari ${customers.length}` : "member"}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={isRefreshing}
                className="h-8 px-2 border-gray-200 bg-secondary hover:bg-gray-200"
                title="Refresh data"
                onClick={async () => {
                  setIsRefreshing(true);
                  await qc.invalidateQueries({ queryKey: ["customers"] });
                  setIsRefreshing(false);
                }}
              >
                <RefreshCw className={cn("h-3.5 w-3.5 text-gray-600", isRefreshing && "animate-spin")} />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Cari customer..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="pl-9 w-55"
                />
              </div>
              <PermissionGate module="customers" action="create">
                <Button onClick={handleAdd} className="cursor-pointer bg-gray-900 hover:bg-gray-800 text-white">
                  <Plus className="h-4 w-4 mr-2" /> Tambah Customer
                </Button>
              </PermissionGate>
            </div>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Users className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">{search ? `Tidak ada hasil untuk "${search}"` : "Belum ada customer."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-225 text-sm">
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="px-3 w-12.5">No</TableHead>
                    <TableHead className="px-3">Nama</TableHead>
                    <TableHead className="px-3 max-w-32">No. HP</TableHead>
                    <TableHead className="px-3">Type</TableHead>
                    <TableHead className="px-3">Bitrix ID</TableHead>
                    <TableHead className="px-3">Status</TableHead>
                    <TableHead className="px-3">Notes</TableHead>
                    <TableHead className="px-3">Updated By</TableHead>
                    <TableHead className="px-3">Updated At</TableHead>
                    <TableHead className="px-3 w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((customer, idx) => (
                    <TableRow key={customer.id} className="hover:bg-gray-50">
                      <TableCell className="px-3">{(currentPage - 1) * ROWS_PER_PAGE + idx + 1}</TableCell>
                      <TableCell className="px-3 max-w-45 truncate font-medium" title={customer.name}>{customer.name}</TableCell>
                      <TableCell className="px-3 max-w-32 overflow-hidden">
                        <Tooltip>
                          <TooltipTrigger className="block truncate w-full text-left">
                            {formatMobileNumbers(customer.mobileNumber)}
                          </TooltipTrigger>
                          <TooltipContent className="max-w-64">
                            {parseMobileNumbers(customer.mobileNumber).map((e, i) => (
                              <div key={i}>{e.name ? `${e.name}: ${e.number}` : e.number}</div>
                            ))}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="px-3">{customer.type}</TableCell>
                      <TableCell className="px-3">
                        {customer.bitrixId ? (
                          <button type="button" className="flex items-center gap-1 group" onClick={() => { navigator.clipboard.writeText(customer.bitrixId!); toast.success("Bitrix ID copied!"); }}>
                            <Badge variant="secondary" className="font-mono text-xs">{customer.bitrixId}</Badge>
                            <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="px-3">
                        <Badge variant="outline" className={cn("text-xs", MEMBER_STATUS_COLORS[customer.memberStatus] ?? "")}>
                          {customer.memberStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3 max-w-37.5 truncate text-gray-500" title={customer.notes ?? ""}>{customer.notes || "—"}</TableCell>
                      <TableCell className="px-3 text-gray-500">{customer.updatedBy || "—"}</TableCell>
                      <TableCell className="px-3 text-gray-500 whitespace-nowrap">{format(new Date(customer.updatedAt), "dd MMM yyyy")}</TableCell>
                      <TableCell className="px-3">
                        <div className="flex items-center gap-1">
                          <PermissionGate module="customers" action="edit">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(customer)}>
                              <PencilIcon className="h-4 w-4" />
                            </Button>
                          </PermissionGate>
                          <PermissionGate module="customers" action="delete">
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(customer)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </PermissionGate>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center px-6 py-4 border-t">
              <Button variant="outline" onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button key={page} onClick={() => setCurrentPage(page)}
                    className={cn("px-3 py-1 rounded-md text-sm font-medium cursor-pointer", currentPage === page ? "bg-gray-200 text-gray-900" : "text-gray-700 hover:bg-gray-100")}>
                    {page}
                  </button>
                ))}
              </div>
              <Button variant="outline" onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>
                Next <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <CustomerDrawer open={drawerOpen} onOpenChange={handleDrawerClose} editCustomer={editCustomer} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus <strong>{deleteTarget?.name}</strong>? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
