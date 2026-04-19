"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  useRoles,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  useUpdateRolePermissions,
} from "@/hooks/use-roles";
import { createRoleSchema, updateRoleSchema } from "@/lib/validations/user";
import type { RolesQueryResult, RoleQueryItem } from "@/lib/queries/roles";
import type { PermissionsQueryResult } from "@/lib/queries/permissions";
import type { z } from "zod";

type CreateRoleValues = z.infer<typeof createRoleSchema>;
type UpdateRoleValues = z.infer<typeof updateRoleSchema>;

interface RolesManagerProps {
  initialRoles: RolesQueryResult;
  initialPermissions: PermissionsQueryResult;
}

const ACTIONS = ["view", "create", "update", "delete"];

export function RolesManager({ initialRoles, initialPermissions }: RolesManagerProps) {
  const { data: roles } = useRoles(initialRoles);
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();
  const updateRolePermissions = useUpdateRolePermissions();

  const [selectedRole, setSelectedRole] = useState<RoleQueryItem | null>(null);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleQueryItem | null>(null);

  const createForm = useForm<CreateRoleValues>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: { name: "", description: "" },
  });

  const editForm = useForm<UpdateRoleValues>({
    resolver: zodResolver(updateRoleSchema),
    defaultValues: { id: "", name: "", description: "" },
  });

  function openCreate() {
    createForm.reset({ name: "", description: "" });
    setDialogMode("create");
  }

  function openEdit(role: RoleQueryItem) {
    editForm.reset({ id: role.id, name: role.name, description: role.description ?? "" });
    setDialogMode("edit");
  }

  async function onCreateSubmit(values: CreateRoleValues) {
    const fd = new FormData();
    fd.set("name", values.name);
    if (values.description) fd.set("description", values.description);
    const result = await createRole.mutateAsync(fd);
    if (result.success) {
      toast.success("Role berhasil dibuat");
      setDialogMode(null);
    } else {
      toast.error(result.error ?? "Gagal membuat role");
    }
  }

  async function onEditSubmit(values: UpdateRoleValues) {
    const fd = new FormData();
    fd.set("id", values.id);
    fd.set("name", values.name);
    if (values.description) fd.set("description", values.description);
    const result = await updateRole.mutateAsync(fd);
    if (result.success) {
      toast.success("Role berhasil diperbarui");
      setDialogMode(null);
    } else {
      toast.error(result.error ?? "Gagal memperbarui role");
    }
  }

  async function onDelete() {
    if (!deleteTarget) return;
    const result = await deleteRole.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
    if (result.success) {
      toast.success("Role berhasil dihapus");
      if (selectedRole?.id === deleteTarget.id) setSelectedRole(null);
    } else {
      toast.error(result.error ?? "Gagal menghapus role");
    }
  }

  // Build permission matrix for selected role
  const modules = [...new Set(initialPermissions.map((p) => p.module))].sort();
  const selectedRoleData = roles?.find((r) => r.id === selectedRole?.id);
  const activePermIds = new Set(
    selectedRoleData?.rolePermissions.map((rp) => rp.permission.id) ?? []
  );

  async function handlePermissionToggle(permId: string, checked: boolean) {
    if (!selectedRoleData) return;
    const current = new Set(activePermIds);
    if (checked) current.add(permId);
    else current.delete(permId);
    const result = await updateRolePermissions.mutateAsync({
      roleId: selectedRoleData.id,
      permissionIds: [...current],
    });
    if (!result.success) toast.error(result.error ?? "Gagal memperbarui permission");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Role & Permission</h1>
          <p className="text-sm text-muted-foreground">Kelola role dan hak akses pengguna.</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Tambah Role
        </Button>
      </div>

      {/* Role list */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {roles?.map((role) => (
          <Card
            key={role.id}
            className={`cursor-pointer transition-all ${
              selectedRole?.id === role.id ? "ring-2 ring-primary" : "hover:shadow-md"
            }`}
            onClick={() => setSelectedRole(role)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-semibold">{role.name}</CardTitle>
                </div>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(role)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {role.name.toLowerCase() !== "admin" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(role)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">{role.description ?? "—"}</p>
              <Badge variant="secondary" className="mt-2 text-xs">
                {role._count.profiles} pengguna
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Permission matrix */}
      {selectedRoleData && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">
            Permission untuk: <span className="text-primary">{selectedRoleData.name}</span>
          </h2>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Modul</TableHead>
                  {ACTIONS.map((a) => (
                    <TableHead key={a} className="text-center capitalize w-24">
                      {a}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {modules.map((module) => (
                  <TableRow key={module}>
                    <TableCell className="font-medium capitalize">{module}</TableCell>
                    {ACTIONS.map((action) => {
                      const perm = initialPermissions.find(
                        (p) => p.module === module && p.action === action
                      );
                      if (!perm) return <TableCell key={action} />;
                      return (
                        <TableCell key={action} className="text-center">
                          <Checkbox
                            checked={activePermIds.has(perm.id)}
                            onCheckedChange={(val) =>
                              handlePermissionToggle(perm.id, !!val)
                            }
                            disabled={updateRolePermissions.isPending}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogMode === "create"} onOpenChange={(o) => !o && setDialogMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Role Baru</DialogTitle>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Role</FormLabel>
                    <FormControl>
                      <Input placeholder="Nama role" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deskripsi</FormLabel>
                    <FormControl>
                      <Input placeholder="Deskripsi (opsional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogMode(null)}>
                  Batal
                </Button>
                <Button type="submit" disabled={createRole.isPending}>
                  {createRole.isPending ? "Menyimpan..." : "Simpan"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={dialogMode === "edit"} onOpenChange={(o) => !o && setDialogMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Role</FormLabel>
                    <FormControl>
                      <Input placeholder="Nama role" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deskripsi</FormLabel>
                    <FormControl>
                      <Input placeholder="Deskripsi (opsional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogMode(null)}>
                  Batal
                </Button>
                <Button type="submit" disabled={updateRole.isPending}>
                  {updateRole.isPending ? "Menyimpan..." : "Simpan"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete AlertDialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Role</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus role{" "}
              <strong>{deleteTarget?.name}</strong>? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
