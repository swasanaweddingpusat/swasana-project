"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { useUsers, useDeleteUser } from "@/hooks/use-users";
import { resendInvitation } from "@/actions/user";
import type { UsersQueryResult, UserQueryItem } from "@/lib/queries/users";
import type { RolesQueryResult } from "@/lib/queries/roles";
import type { VenuesQueryResult } from "@/lib/queries/venues";
import { InviteDrawer } from "./invite-drawer";
import { Pencil, Trash2, Mail, UserPlus } from "lucide-react";

interface UsersTableProps {
  initialData: UsersQueryResult;
  roles: RolesQueryResult;
  venues: VenuesQueryResult;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "active":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Aktif</Badge>;
    case "suspended":
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Suspended</Badge>;
    default:
      return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Nonaktif</Badge>;
  }
}

function getInitials(name: string | null | undefined, email: string) {
  if (name) {
    return name
      .split(" ")
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  }
  return email[0].toUpperCase();
}

export function UsersTable({ initialData, roles, venues }: UsersTableProps) {
  const { data: users } = useUsers(initialData);
  const deleteUser = useDeleteUser();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserQueryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserQueryItem | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  function handleInvite() {
    setEditUser(null);
    setDrawerOpen(true);
  }

  function handleEdit(user: UserQueryItem) {
    setEditUser(user);
    setDrawerOpen(true);
  }

  async function handleResend(user: UserQueryItem) {
    if (!user.profile) return;
    setResendingId(user.profile.id);
    const result = await resendInvitation(user.profile.id);
    setResendingId(null);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.error);
    }
  }

  async function handleDelete() {
    if (!deleteTarget?.profile) return;
    const result = await deleteUser.mutateAsync(deleteTarget.profile.id);
    setDeleteTarget(null);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">{users?.length ?? 0} pengguna</p>
        <Button onClick={handleInvite} size="sm">
          <UserPlus className="mr-2 h-4 w-4" />
          Undang Pengguna
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Email Verified</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!users || users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                  Belum ada pengguna.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.profile?.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(user.profile?.fullName, user.email)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">
                        {user.profile?.fullName ?? user.name ?? "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    {user.profile?.role ? (
                      <Badge variant="outline">{user.profile.role.name}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.profile ? getStatusBadge(user.profile.status) : "—"}
                  </TableCell>
                  <TableCell>
                    {user.profile?.isEmailVerified ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                        Verified
                      </Badge>
                    ) : (
                      <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {user.profile && !user.profile.isEmailVerified && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Kirim ulang undangan"
                          disabled={resendingId === user.profile.id}
                          onClick={() => handleResend(user)}
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit"
                        onClick={() => handleEdit(user)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Hapus"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(user)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <InviteDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        roles={roles}
        venues={venues}
        editUser={editUser}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pengguna</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus{" "}
              <strong>{deleteTarget?.profile?.fullName ?? deleteTarget?.email}</strong>? Tindakan
              ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
